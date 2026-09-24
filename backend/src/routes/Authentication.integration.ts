import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Errors, RateLimits, UserMessages, envs } from '@/config';
import type { User } from '@/domain/models';
import { Bcrypt } from '@/infra/cryptography';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
  FIXTURE_PASSWORD,
  createAsset,
  createPortfolio,
  createTransaction,
  createUser,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { injectWriteFailure } from '@/test/TestDatabase';

const SIGN_UP_ROUTE = '/v1/user/create';
const SIGN_IN_ROUTE = '/v1/user';
const SIGN_OUT_ROUTE = '/v1/user/sign-out';
const ACCOUNT_ROUTE = '/v1/user';
const USERS_ROUTE = '/v1/users';

/** Answers 200 to any caller holding a current session, so its status reflects authentication alone. */
const AUTHENTICATED_ROUTE = '/v1/portfolios';

/** Mirrors the name `CreateUserService` gives the portfolio every account starts with. */
const FIRST_PORTFOLIO_NAME = 'Main';

/** `CreatePortfolioSchema` bounds a portfolio name to this many characters. */
const PORTFOLIO_NAME_MAX_LENGTH = 60;

/**
 * Enough requests to pass an existence check together; below the sign-up rate
 * limit, which would otherwise decide the outcome instead of the database.
 */
const CONCURRENT_SIGN_UPS = 3;

/** Mirror `NewPasswordSchema`: the minimum counts code points, the maximum UTF-8 bytes. */
const PASSWORD_MIN_CODE_POINTS = 8;
const PASSWORD_MAX_BYTES = 72;

/** `!`, the first printable ASCII character: one code point, one UTF-8 byte. */
const PRINTABLE_ASCII_START = 0x21;

/** `😀`, the first of a run of emoji: each one code point, two UTF-16 code units, four UTF-8 bytes. */
const ASTRAL_START = 0x1f600;
const ASTRAL_CHARACTER_BYTES = 4;

/** No two characters alike, so the rule against repeating one is not what decides a length case. */
const distinctCharacters = (firstCodePoint: number, count: number) =>
  String.fromCodePoint(
    ...Array.from({ length: count }, (_, offset) => firstCodePoint + offset)
  );

/**
 * One second after the Unix epoch: expired under any clock, and with
 * `noTimestamp` the signed token is byte-identical on every run.
 */
const EXPIRED_AT_EPOCH_SECONDS = 1;

const NEW_USER = {
  name: 'Newcomer',
  email: 'newcomer@ex3.app',
  password: 'onboarding-password',
  baseCurrency: 'USD'
};

const REPLACEMENT_PASSWORD = 'replacement-password';

type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

const PROTECTED_ROUTES: ReadonlyArray<readonly [HttpMethod, string]> = [
  ['get', USERS_ROUTE],
  ['get', ACCOUNT_ROUTE],
  ['patch', ACCOUNT_ROUTE],
  ['delete', ACCOUNT_ROUTE],
  ['post', SIGN_OUT_ROUTE],
  ['get', '/v1/portfolio'],
  ['get', '/v1/portfolio/allocation'],
  ['get', '/v1/portfolio/overview'],
  ['get', '/v1/portfolio/positions'],
  ['get', '/v1/portfolio/positions/PETR4/indicators'],
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

const signToken = (payload: object, secret = envs.jwtSecret) =>
  jwt.sign(payload, secret, { noTimestamp: true });

const encodeSegment = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const unsignedToken = (payload: object) =>
  `${encodeSegment({ alg: 'none', typ: 'JWT' })}.${encodeSegment(payload)}.`;

/**
 * Claims matching the stored session, so the only condition left to reject a
 * crafted token is the one the test is about.
 */
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

    /**
     * Response time is too noisy to assert on; one bcrypt verification per
     * attempt is the deterministic evidence that both branches do equal work.
     */
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

    /** Back-to-back sign-ins share `iat`, which made their tokens identical before session versions. */
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
          email: stored.email,
          createdAt: stored.createdAt.toISOString(),
          updatedAt: stored.updatedAt.toISOString()
        }
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
