import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { envs, Errors, ProxyHeaders, RateLimits, UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { Bcrypt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
  createAsset,
  createPortfolio,
  createTransaction,
  createUser,
  FIXTURE_PASSWORD,
  FIXTURE_USER_EMAIL,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { injectWriteFailure } from '@/test/TestDatabase';

const SIGN_UP_ROUTE = '/v1/user/create';
const SIGN_IN_ROUTE = '/v1/user';
const SIGN_OUT_ROUTE = '/v1/user/sign-out';
const ACCOUNT_ROUTE = '/v1/user';
const USERS_ROUTE = '/v1/users';

const AUTHENTICATED_ROUTE = '/v1/portfolios';

const FIRST_PORTFOLIO_NAME = 'Main';

const PERSON_NAME_MAX_LENGTH = 255;

const PORTFOLIO_NAME_MAX_LENGTH = 60;

/**
 * Enough requests to pass an existence check together; below the sign-up rate
 * limit, which would otherwise decide the outcome instead of the database.
 */
const CONCURRENT_SIGN_UPS = 3;

/** Mirror `NewPasswordSchema`: the minimum counts code points, the maximum UTF-8 bytes. */
const PASSWORD_MIN_CODE_POINTS = 8;
const PASSWORD_MAX_BYTES = 72;

const PRINTABLE_ASCII_START = 0x21;

const ASTRAL_START = 0x1f600;
const ASTRAL_CHARACTER_BYTES = 4;

const distinctCharacters = (firstCodePoint: number, count: number) =>
  String.fromCodePoint(
    ...Array.from({ length: count }, (_, offset) => firstCodePoint + offset)
  );

const EXPIRED_AT_EPOCH_SECONDS = 1;

const NEW_USER = {
  firstName: 'Maria Clara',
  lastName: 'da Silva',
  email: 'newcomer@ex3.app',
  password: 'onboarding-password',
  baseCurrency: 'USD'
};

const REPLACEMENT_PASSWORD = 'replacement-password';

const LEGACY_BCRYPT_COST = 4;

const TIMING_SAMPLES = 15;

/**
 * Generous on purpose: verifying a digest at the minimum cost takes tens of
 * milliseconds, so a branch that skipped it would answer in a fraction of the
 * other's time, far below this ratio, while scheduling noise stays above it.
 */
const MIN_TIMING_RATIO = 0.6;

const TIMING_NETWORK = '198.51.100';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

const PROTECTED_ROUTES: ReadonlyArray<readonly [HttpMethod, string]> = [
  ['get', USERS_ROUTE],
  ['get', ACCOUNT_ROUTE],
  ['patch', ACCOUNT_ROUTE],
  ['delete', ACCOUNT_ROUTE],
  ['post', SIGN_OUT_ROUTE],
  ['get', '/v1/portfolio'],
  ['get', '/v1/portfolio/allocation'],
  ['get', '/v1/portfolio/income'],
  ['get', '/v1/portfolio/overview'],
  ['get', '/v1/portfolio/positions'],
  ['get', '/v1/portfolio/positions/PETR4/indicators'],
  ['get', '/v1/portfolio/positions/PETR4/fundamentals'],
  ['get', '/v1/portfolios'],
  ['post', '/v1/portfolio'],
  ['patch', '/v1/portfolio'],
  ['delete', '/v1/portfolio'],
  ['post', '/v1/asset'],
  ['patch', '/v1/asset/BTC'],
  ['delete', '/v1/asset/BTC'],
  ['get', '/v1/instruments'],
  ['post', '/v1/instrument'],
  ['patch', '/v1/instrument/BTC'],
  ['get', '/v1/transaction/unknown-id'],
  ['get', '/v1/transactions'],
  ['post', '/v1/transaction'],
  ['patch', '/v1/transaction/unknown-id'],
  ['delete', '/v1/transaction/unknown-id']
];

const prismaClient = PrismaClient.getInstance();

const median = (samples: ReadonlyArray<number>) =>
  [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? NaN;

const elapsedMs = async (operation: () => PromiseLike<unknown>) => {
  const startedAt = performance.now();

  await operation();

  return performance.now() - startedAt;
};

const signToken = (payload: object, secret = envs.jwtSecret) =>
  jwt.sign(payload, secret, { noTimestamp: true });

const encodeSegment = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const unsignedToken = (payload: object) =>
  `${encodeSegment({ alg: 'none', typ: 'JWT' })}.${encodeSegment(payload)}.`;

const currentSessionClaims = (user: Pick<User, 'id' | 'sessionVersion'>) => ({
  sub: user.id,
  sessionVersion: user.sessionVersion
});

describe('authentication', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  const signUpWithPassword = (password: string) =>
    client.post(SIGN_UP_ROUTE).send({ ...NEW_USER, password });

  describe('sign-up', () => {
    it('creates an account whose token authenticates immediately, holding one portfolio in the chosen currency', async () => {
      const res = await client.post(SIGN_UP_ROUTE).send(NEW_USER);

      assert.equal(res.status, 201);
      assert.equal(res.body.message, UserMessages.CREATED);
      assert.equal(res.body.user.email, NEW_USER.email);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.sessionVersion, undefined);
      assert.equal(res.body.user.isAdmin, undefined);

      const listed = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(res.body.user.accessToken));

      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.portfolios.map(
          ({
            name,
            baseCurrency
          }: Record<'name' | 'baseCurrency', string>) => ({
            name,
            baseCurrency
          })
        ),
        [{ name: FIRST_PORTFOLIO_NAME, baseCurrency: NEW_USER.baseCurrency }]
      );
    });

    it('stores the first and last names, trimmed, and the full name they make', async () => {
      const res = await client.post(SIGN_UP_ROUTE).send({
        ...NEW_USER,
        firstName: ' Maria Clara ',
        lastName: 'da Silva '
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.user.firstName, 'Maria Clara');
      assert.equal(res.body.user.lastName, 'da Silva');
      assert.equal(res.body.user.name, 'Maria Clara da Silva');

      const stored = await prismaClient.user.findUniqueOrThrow({
        where: { email: NEW_USER.email }
      });

      assert.equal(stored.firstName, 'Maria Clara');
      assert.equal(stored.lastName, 'da Silva');
      assert.equal(stored.name, 'Maria Clara da Silva');
    });

    it('takes the first name alone as the full name when no last name is given', async () => {
      for (const [email, lastName] of [
        ['no-last-name@ex3.app', undefined],
        ['blank-last-name@ex3.app', '  ']
      ] as const) {
        const res = await client
          .post(SIGN_UP_ROUTE)
          .send({ ...NEW_USER, email, lastName });

        assert.equal(res.status, 201, email);
        assert.equal(res.body.user.lastName, null, email);
        assert.equal(res.body.user.name, NEW_USER.firstName, email);
      }
    });

    it('creates an account given no name without a full name, not an empty one', async () => {
      const { firstName, lastName, ...unnamed } = NEW_USER;
      const res = await client.post(SIGN_UP_ROUTE).send(unnamed);

      assert.equal(res.status, 201);
      assert.equal(res.body.user.firstName, null);
      assert.equal(res.body.user.lastName, null);
      assert.equal(res.body.user.name, null);
    });

    it('rejects a blank or overlong name and creates nothing', async () => {
      for (const names of [
        { firstName: '' },
        { firstName: '   ' },
        { firstName: 'x'.repeat(PERSON_NAME_MAX_LENGTH + 1) },
        { lastName: 'x'.repeat(PERSON_NAME_MAX_LENGTH + 1) }
      ]) {
        const res = await client
          .post(SIGN_UP_ROUTE)
          .send({ ...NEW_USER, ...names });

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(names)
        );
      }

      assert.equal(await prismaClient.user.count(), 0);
    });

    it('names the first portfolio as the sign-up asks, trimmed', async () => {
      const res = await client
        .post(SIGN_UP_ROUTE)
        .send({ ...NEW_USER, portfolioName: '  Long term  ' });

      assert.equal(res.status, 201);

      const listed = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(res.body.user.accessToken));

      assert.deepEqual(
        listed.body.portfolios.map(({ name }: Record<'name', string>) => name),
        ['Long term']
      );
    });

    it('rejects a blank or overlong portfolio name and creates nothing', async () => {
      for (const portfolioName of [
        '',
        '   ',
        'x'.repeat(PORTFOLIO_NAME_MAX_LENGTH + 1)
      ]) {
        const res = await client
          .post(SIGN_UP_ROUTE)
          .send({ ...NEW_USER, portfolioName });

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          `"${portfolioName}"`
        );
      }

      assert.equal(await prismaClient.user.count(), 0);
      assert.equal(await prismaClient.portfolio.count(), 0);
    });

    it('stores a password digest that still verifies', async () => {
      await client.post(SIGN_UP_ROUTE).send(NEW_USER);

      const stored = await prismaClient.user.findUniqueOrThrow({
        where: { email: NEW_USER.email }
      });

      assert.notEqual(stored.password, NEW_USER.password);
      await signIn({ email: NEW_USER.email, password: NEW_USER.password });
    });

    it('rejects an email already registered, regardless of case', async () => {
      const existing = await createUser();

      const res = await client
        .post(SIGN_UP_ROUTE)
        .send({ ...NEW_USER, email: existing.email.toUpperCase() });

      assert.equal(res.status, Errors.CONFLICT.status);
      assert.equal(res.body.message, UserMessages.ALREADY_EXISTS);
    });

    it('lets exactly one of concurrent sign-ups for one email succeed, creating a single portfolio', async () => {
      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_SIGN_UPS }, () =>
          client.post(SIGN_UP_ROUTE).send(NEW_USER)
        )
      );

      const [created, ...rejected] = responses.toSorted(
        (left, right) => left.status - right.status
      );

      assert.equal(created?.status, 201);
      for (const res of rejected) {
        assert.equal(res.status, Errors.CONFLICT.status);
        assert.equal(res.body.message, UserMessages.ALREADY_EXISTS);
      }
      assert.equal(await prismaClient.user.count(), 1);
      assert.equal(await prismaClient.portfolio.count(), 1);
    });

    it('rejects an invalid email', async () => {
      const res = await client
        .post(SIGN_UP_ROUTE)
        .send({ ...NEW_USER, email: 'not-an-email' });

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('rejects a missing or unknown base currency and creates nothing', async () => {
      for (const baseCurrency of [undefined, '', 'US', 'ZZZ']) {
        const res = await client
          .post(SIGN_UP_ROUTE)
          .send({ ...NEW_USER, baseCurrency });

        assert.equal(res.status, Errors.VALIDATION.status, `"${baseCurrency}"`);
      }

      assert.equal(await prismaClient.user.count(), 0);
      assert.equal(await prismaClient.portfolio.count(), 0);
    });

    it('rejects a password one character below the minimum', async () => {
      const res = await signUpWithPassword(
        distinctCharacters(PRINTABLE_ASCII_START, PASSWORD_MIN_CODE_POINTS - 1)
      );

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('accepts a password at exactly the minimum length', async () => {
      const res = await signUpWithPassword(
        distinctCharacters(PRINTABLE_ASCII_START, PASSWORD_MIN_CODE_POINTS)
      );

      assert.equal(res.status, 201);
    });

    it('counts the minimum in code points, not UTF-16 code units', async () => {
      const res = await signUpWithPassword(
        distinctCharacters(ASTRAL_START, PASSWORD_MIN_CODE_POINTS - 1)
      );

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('accepts a password of exactly 72 bytes', async () => {
      const res = await signUpWithPassword(
        distinctCharacters(PRINTABLE_ASCII_START, PASSWORD_MAX_BYTES)
      );

      assert.equal(res.status, 201);
    });

    it('rejects a password beyond the 72 bytes bcrypt digests', async () => {
      const astralOverLimit = distinctCharacters(
        ASTRAL_START,
        Math.floor(PASSWORD_MAX_BYTES / ASTRAL_CHARACTER_BYTES) + 1
      );

      const ascii = await signUpWithPassword(
        distinctCharacters(PRINTABLE_ASCII_START, PASSWORD_MAX_BYTES + 1)
      );
      const astral = await signUpWithPassword(astralOverLimit);

      assert.equal(ascii.status, Errors.VALIDATION.status);
      assert.equal(astral.status, Errors.VALIDATION.status);
    });

    it('rejects a blank password of valid length', async () => {
      const res = await signUpWithPassword(
        ' '.repeat(PASSWORD_MIN_CODE_POINTS)
      );

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('rejects a password repeating a single character', async () => {
      const res = await signUpWithPassword(
        'z'.repeat(PASSWORD_MIN_CODE_POINTS)
      );

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('rejects a commonly used password in any case', async () => {
      const lower = await signUpWithPassword('password123');
      const mixed = await signUpWithPassword('Password123');

      assert.equal(lower.status, Errors.VALIDATION.status);
      assert.equal(mixed.status, Errors.VALIDATION.status);
      assert.equal(await prismaClient.user.count(), 0);
    });

    it('rejects a password containing the part of the email before the @', async () => {
      const res = await signUpWithPassword('Newcomer-2026');

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.deepEqual(res.body.details, [
        { path: 'password', message: UserMessages.PASSWORD_DERIVED_FROM_EMAIL }
      ]);
    });

    it('keeps surrounding whitespace as part of the password', async () => {
      const padded = `  ${NEW_USER.password}  `;
      await signUpWithPassword(padded);

      const trimmed = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: NEW_USER.email, password: NEW_USER.password });

      assert.equal(trimmed.status, Errors.AUTHENTICATION.status);
      await signIn({ email: NEW_USER.email, password: padded });
    });
  });

  describe('sign-in', () => {
    it('returns a working session token and no credential fields', async () => {
      const { user } = await seedPortfolio();

      const res = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: FIXTURE_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.id, user.id);
      assert.equal(res.body.password, undefined);
      assert.equal(res.body.sessionVersion, undefined);
      assert.equal(res.body.isAdmin, undefined);

      const scoped = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(res.body.accessToken));

      assert.equal(scoped.status, 200);
    });

    it('matches the email case-insensitively', async () => {
      const { user } = await seedPortfolio();

      const accessToken = await signIn({
        email: user.email.toUpperCase(),
        password: FIXTURE_PASSWORD
      });

      assert.ok(accessToken.length > 0);
    });

    it('rejects a wrong password as invalid credentials, without a token', async () => {
      const { user } = await seedPortfolio();

      const res = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: `${FIXTURE_PASSWORD}-wrong` });

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.equal(res.body.message, UserMessages.INVALID_CREDENTIALS);
      assert.equal(res.body.accessToken, undefined);
    });

    it('answers a wrong password exactly like an unknown email', async () => {
      const { user } = await seedPortfolio();

      const wrongPassword = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: `${FIXTURE_PASSWORD}-wrong` });
      const unknownEmail = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: 'nobody@ex3.app', password: FIXTURE_PASSWORD });

      assert.equal(wrongPassword.status, unknownEmail.status);
      assert.deepEqual(wrongPassword.body, unknownEmail.body);
    });

    it('verifies a password even when the email is unknown', async (t) => {
      const compare = t.mock.method(
        Bcrypt.getInstance(envs.bcryptSalt),
        'compare'
      );

      const res = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: 'nobody@ex3.app', password: FIXTURE_PASSWORD });

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.equal(compare.mock.callCount(), 1);
    });

    it('verifies an unknown email against a digest of the configured cost', async (t) => {
      const compare = t.mock.method(
        Bcrypt.getInstance(envs.bcryptSalt),
        'compare'
      );

      await client
        .post(SIGN_IN_ROUTE)
        .send({ email: 'nobody@ex3.app', password: FIXTURE_PASSWORD });

      const [, digest] = compare.mock.calls[0]?.arguments ?? [];

      assert.equal(bcrypt.getRounds(String(digest)), envs.bcryptSalt);
    });

    it('answers an unknown email about as fast as a wrong password', async () => {
      const { user } = await seedPortfolio();
      const attempt = (email: string, sample: number) => {
        assert.ok(
          envs.apiProxySecret,
          'API_PROXY_SECRET must be set for tests'
        );

        return client
          .post(SIGN_IN_ROUTE)
          .set({
            [ProxyHeaders.CLIENT_ADDRESS]: `${TIMING_NETWORK}.${sample + 1}`,
            [ProxyHeaders.PROXY_SECRET]: envs.apiProxySecret
          })
          .send({ email, password: `${FIXTURE_PASSWORD}-wrong` });
      };

      await attempt(user.email, 0);
      await attempt('nobody@ex3.app', 0);

      const wrongPassword: number[] = [];
      const unknownEmail: number[] = [];

      for (let sample = 1; sample <= TIMING_SAMPLES; sample += 1) {
        wrongPassword.push(await elapsedMs(() => attempt(user.email, sample)));
        unknownEmail.push(
          await elapsedMs(() => attempt('nobody@ex3.app', sample))
        );
      }

      const medians = [median(wrongPassword), median(unknownEmail)];
      const [faster = NaN, slower = NaN] = [...medians].sort((a, b) => a - b);

      assert.ok(
        faster / slower >= MIN_TIMING_RATIO,
        `median ${medians.map((ms) => `${ms.toFixed(1)}ms`).join(' for a wrong password, ')} for an unknown email`
      );
    });

    it('rehashes a digest of another cost at the configured one once the password verifies', async () => {
      const user = await prismaClient.user.create({
        data: {
          email: 'legacy@ex3.app',
          password: await bcrypt.hash(FIXTURE_PASSWORD, LEGACY_BCRYPT_COST)
        }
      });

      await signIn({ email: user.email, password: FIXTURE_PASSWORD });

      const { password } = await prismaClient.user.findUniqueOrThrow({
        where: { id: user.id }
      });

      assert.equal(bcrypt.getRounds(password), envs.bcryptSalt);
      assert.ok(await bcrypt.compare(FIXTURE_PASSWORD, password));
    });

    it('keeps a digest of another cost while the password does not verify', async () => {
      const legacyDigest = await bcrypt.hash(
        FIXTURE_PASSWORD,
        LEGACY_BCRYPT_COST
      );
      const user = await prismaClient.user.create({
        data: { email: 'legacy@ex3.app', password: legacyDigest }
      });

      const res = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: `${FIXTURE_PASSWORD}-wrong` });

      const { password } = await prismaClient.user.findUniqueOrThrow({
        where: { id: user.id }
      });

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.equal(password, legacyDigest);
    });

    it('does not rehash over a password changed since the sign-in verified it', async () => {
      const legacyDigest = await bcrypt.hash(
        FIXTURE_PASSWORD,
        LEGACY_BCRYPT_COST
      );
      const user = await prismaClient.user.create({
        data: { email: 'legacy@ex3.app', password: legacyDigest }
      });
      const changedDigest = await bcrypt.hash(
        REPLACEMENT_PASSWORD,
        envs.bcryptSalt
      );

      await prismaClient.user.update({
        where: { id: user.id },
        data: { password: changedDigest }
      });
      await UserRepository.getInstance().rehashPassword(
        user.id,
        legacyDigest,
        FIXTURE_PASSWORD
      );

      const { password } = await prismaClient.user.findUniqueOrThrow({
        where: { id: user.id }
      });

      assert.equal(password, changedDigest);
    });

    it('does not count successful sign-ins against the account', async () => {
      const { user } = await seedPortfolio();
      const credentials = { email: user.email, password: FIXTURE_PASSWORD };

      for (
        let attempt = 0;
        attempt <= RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS.limit;
        attempt += 1
      )
        await signIn(credentials);
    });

    it('keeps the active session after a failed attempt', async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: `${FIXTURE_PASSWORD}-wrong` });

      const res = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
    });

    it('issues a distinct token on every sign-in and revokes the previous one', async () => {
      const { user } = await seedPortfolio();
      const credentials = { email: user.email, password: FIXTURE_PASSWORD };

      const first = await signIn(credentials);
      const second = await signIn(credentials);

      assert.notEqual(first, second);

      const revoked = await client.get(AUTHENTICATED_ROUTE).set(bearer(first));
      const active = await client.get(AUTHENTICATED_ROUTE).set(bearer(second));

      assert.equal(revoked.status, Errors.AUTHENTICATION.status);
      assert.match(revoked.body.message, /no longer active/i);
      assert.equal(active.status, 200);
    });
  });

  describe('invalid token', () => {
    it('rejects a token signed with another secret', async () => {
      const { user } = await seedPortfolio();
      const forged = signToken(
        currentSessionClaims(user),
        `${envs.jwtSecret}-rotated`
      );

      const res = await client.get(AUTHENTICATED_ROUTE).set(bearer(forged));

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.match(res.body.message, /invalid/i);
    });

    it('rejects an unsigned token', async () => {
      const { user } = await seedPortfolio();
      const forged = unsignedToken(currentSessionClaims(user));

      const res = await client.get(AUTHENTICATED_ROUTE).set(bearer(forged));

      assert.equal(res.status, Errors.AUTHENTICATION.status);
    });

    it('rejects a genuine token issued before session versions', async () => {
      const { user } = await seedPortfolio();
      const legacy = signToken({ id: user.id });

      const res = await client.get(AUTHENTICATED_ROUTE).set(bearer(legacy));

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.match(res.body.message, /invalid/i);
    });

    it('rejects a value that is not a JWT', async () => {
      const res = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer('not-a-jwt'));

      assert.equal(res.status, Errors.AUTHENTICATION.status);
    });
  });

  describe('expired token', () => {
    it('rejects an expired token even while its session is current', async () => {
      const { user } = await seedPortfolio();
      const expired = signToken({
        ...currentSessionClaims(user),
        exp: EXPIRED_AT_EPOCH_SECONDS
      });

      const res = await client.get(AUTHENTICATED_ROUTE).set(bearer(expired));

      assert.equal(res.status, Errors.AUTHENTICATION.status);
      assert.match(res.body.message, /expired/i);
    });
  });

  describe('sign-out', () => {
    it('revokes the token it was called with', async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client.post(SIGN_OUT_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.message, UserMessages.SIGNED_OUT);

      const revoked = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(revoked.status, Errors.AUTHENTICATION.status);
      assert.match(revoked.body.message, /no longer active/i);
    });
  });

  describe('password change', () => {
    const signInFixtureUser = async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      return { user, accessToken };
    };

    it('revokes the session and accepts only the new password afterwards', async () => {
      const { user, accessToken } = await signInFixtureUser();

      const res = await client
        .patch(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({
          oldPassword: FIXTURE_PASSWORD,
          newPassword: REPLACEMENT_PASSWORD
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.sessionVersion, undefined);

      const revoked = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));
      const previousPassword = await client
        .post(SIGN_IN_ROUTE)
        .send({ email: user.email, password: FIXTURE_PASSWORD });

      assert.equal(revoked.status, Errors.AUTHENTICATION.status);
      assert.equal(previousPassword.status, Errors.AUTHENTICATION.status);
      await signIn({ email: user.email, password: REPLACEMENT_PASSWORD });
    });

    it('rejects a new password sent without the current one', async () => {
      const { user, accessToken } = await signInFixtureUser();

      const res = await client
        .patch(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({ newPassword: REPLACEMENT_PASSWORD });

      assert.equal(res.status, Errors.VALIDATION.status);
      await signIn({ email: user.email, password: FIXTURE_PASSWORD });
    });

    it('rejects a wrong current password and keeps the session', async () => {
      const { accessToken } = await signInFixtureUser();

      const res = await client
        .patch(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({
          oldPassword: `${FIXTURE_PASSWORD}-wrong`,
          newPassword: REPLACEMENT_PASSWORD
        });

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.equal(res.body.message, UserMessages.INVALID_PASSWORD);

      const scoped = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(scoped.status, 200);
    });

    it('holds the new password to the sign-up policy', async () => {
      const { accessToken } = await signInFixtureUser();

      const res = await client
        .patch(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({
          oldPassword: FIXTURE_PASSWORD,
          newPassword: 'a'.repeat(PASSWORD_MIN_CODE_POINTS - 1)
        });

      assert.equal(res.status, Errors.VALIDATION.status);
    });

    it('refuses a new password containing the part of the email before the @, keeping the session', async () => {
      const { user, accessToken } = await signInFixtureUser();

      const res = await client
        .patch(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({
          oldPassword: FIXTURE_PASSWORD,
          newPassword: `${user.email.slice(0, user.email.indexOf('@'))}-2026`
        });

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.deepEqual(res.body.details, [
        {
          path: 'newPassword',
          message: UserMessages.PASSWORD_DERIVED_FROM_EMAIL
        }
      ]);

      const scoped = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(scoped.status, 200);
    });

    it('throttles repeated failed password-verifying requests', async () => {
      const statuses: Array<number> = [];

      for (
        let attempt = 0;
        attempt <= RateLimits.ACCOUNT_CHANGE.limit;
        attempt += 1
      )
        statuses.push((await client.patch(ACCOUNT_ROUTE)).status);

      assert.ok(
        statuses
          .slice(0, RateLimits.ACCOUNT_CHANGE.limit)
          .every((status) => status === Errors.AUTHENTICATION.status)
      );
      assert.equal(statuses.at(-1), Errors.THROTTLED.status);
    });
  });

  describe('account deletion', () => {
    const OTHER_USER = { email: 'other@ex3.app', symbol: 'ETH' };

    const storedRowCounts = () =>
      Promise.all([
        prismaClient.user.count(),
        prismaClient.portfolio.count(),
        prismaClient.position.count(),
        prismaClient.transaction.count()
      ]);

    it('removes the account with every portfolio it holds and ends its session', async () => {
      const { user } = await seedPortfolio();
      const secondPortfolio = await createPortfolio(user.id, {
        name: 'Second'
      });
      await createTransaction(
        await createAsset({ portfolioId: secondPortfolio.id })
      );
      await seedPortfolio(OTHER_USER);
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client
        .delete(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({ password: FIXTURE_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, UserMessages.DELETED);
      assert.deepEqual(await storedRowCounts(), [1, 1, 1, 1]);
      assert.equal(
        await prismaClient.user.count({ where: { email: OTHER_USER.email } }),
        1
      );

      const afterDeletion = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(afterDeletion.status, Errors.AUTHENTICATION.status);
    });

    it('keeps the account and everything it holds when the password is wrong', async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client
        .delete(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({ password: `${FIXTURE_PASSWORD}-wrong` });

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.equal(res.body.message, UserMessages.INVALID_PASSWORD);
      assert.deepEqual(await storedRowCounts(), [1, 1, 1, 1]);
    });

    it('keeps the account and everything it holds when removing the user fails', async (t) => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });
      injectWriteFailure(t, 'user', 'deleteMany');
      t.mock.method(console, 'error', () => undefined);

      const res = await client
        .delete(ACCOUNT_ROUTE)
        .set(bearer(accessToken))
        .send({ password: FIXTURE_PASSWORD });

      assert.equal(res.status, Errors.INTERNAL.status);
      assert.deepEqual(await storedRowCounts(), [1, 1, 1, 1]);
    });
  });

  describe('profile', () => {
    it("returns the caller's profile without credential columns", async () => {
      const { user } = await seedPortfolio();
      await createUser({ email: 'other@ex3.app' });
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });
      const stored = await prismaClient.user.findUniqueOrThrow({
        where: { id: user.id }
      });

      const res = await client.get(ACCOUNT_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        user: {
          id: stored.id,
          name: stored.name,
          firstName: stored.firstName,
          lastName: stored.lastName,
          email: stored.email,
          createdAt: stored.createdAt.toISOString(),
          updatedAt: stored.updatedAt.toISOString()
        }
      });
    });
  });

  describe('name change', () => {
    const signInFixtureUser = async () => {
      const { user } = await seedPortfolio();

      return signIn({ email: user.email, password: FIXTURE_PASSWORD });
    };

    const changeNames = async (accessToken: string, names: object) =>
      client.patch(ACCOUNT_ROUTE).set(bearer(accessToken)).send(names);

    const storedNames = async () =>
      prismaClient.user.findUniqueOrThrow({
        where: { email: FIXTURE_USER_EMAIL },
        select: { name: true, firstName: true, lastName: true }
      });

    it('replaces both names and the full name, and keeps the session', async () => {
      const accessToken = await signInFixtureUser();

      const res = await changeNames(accessToken, {
        firstName: ' Ana ',
        lastName: ' Lima'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, UserMessages.UPDATED);
      assert.equal(res.body.user.name, 'Ana Lima');
      assert.equal(res.body.user.firstName, 'Ana');
      assert.equal(res.body.user.lastName, 'Lima');
      assert.deepEqual(await storedNames(), {
        name: 'Ana Lima',
        firstName: 'Ana',
        lastName: 'Lima'
      });

      const scoped = await client
        .get(AUTHENTICATED_ROUTE)
        .set(bearer(accessToken));

      assert.equal(scoped.status, 200);
    });

    it('keeps the name it is not given', async () => {
      const accessToken = await signInFixtureUser();

      await changeNames(accessToken, { lastName: 'Lima' });

      assert.deepEqual(await storedNames(), {
        name: 'Fixture Lima',
        firstName: 'Fixture',
        lastName: 'Lima'
      });
    });

    it('clears an empty last name, leaving the first name as the full name', async () => {
      const accessToken = await signInFixtureUser();

      const res = await changeNames(accessToken, {
        firstName: 'Fixture',
        lastName: ''
      });

      assert.equal(res.status, 200);
      assert.deepEqual(await storedNames(), {
        name: 'Fixture',
        firstName: 'Fixture',
        lastName: null
      });
    });

    it('rejects a blank first name and keeps the stored names', async () => {
      const accessToken = await signInFixtureUser();

      const res = await changeNames(accessToken, {
        firstName: ' ',
        lastName: 'Lima'
      });

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.deepEqual(await storedNames(), {
        name: 'Fixture Holder',
        firstName: 'Fixture',
        lastName: 'Holder'
      });
    });

    it('leaves the names alone when the change carries none', async () => {
      const accessToken = await signInFixtureUser();

      const res = await changeNames(accessToken, {});

      assert.equal(res.status, 200);
      assert.deepEqual(await storedNames(), {
        name: 'Fixture Holder',
        firstName: 'Fixture',
        lastName: 'Holder'
      });
    });
  });

  describe('user administration', () => {
    it('lists users to an admin without credential columns', async () => {
      await seedPortfolio();
      const admin = await createUser({ email: 'admin@ex3.app', isAdmin: true });
      const accessToken = await signIn({
        email: admin.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client.get(USERS_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.users.length, 2);

      for (const listed of res.body.users) {
        assert.equal(listed.password, undefined);
        assert.equal(listed.sessionVersion, undefined);
      }
    });

    it('forbids the listing to a non-admin', async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client.get(USERS_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, Errors.AUTHORIZATION.status);
    });
  });

  describe('protected routes', () => {
    for (const [method, path] of PROTECTED_ROUTES)
      it(`rejects anonymous ${method.toUpperCase()} ${path}`, async () => {
        const res = await client[method](path);

        assert.equal(res.status, Errors.AUTHENTICATION.status);
      });

    it('rejects a valid token presented in another scheme', async () => {
      const { user } = await seedPortfolio();
      const accessToken = await signIn({
        email: user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client
        .get(AUTHENTICATED_ROUTE)
        .set('Authorization', `Basic ${accessToken}`);

      assert.equal(res.status, Errors.AUTHENTICATION.status);
    });
  });
});
