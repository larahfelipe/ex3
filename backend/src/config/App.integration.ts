import type { Express } from 'express';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';

import { UserRepository } from '@/infra/database';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { RateLimitStore } from '@/infra/database/RateLimitStore';
import {
  accountRateLimitKey,
  addressRateLimitKey
} from '@/middleware/RateLimitMiddleware';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

import { Errors, ProxyHeaders, RateLimits, RequestLimits } from './Constants';
import { envs } from './Envs';

const [ALLOWED_ORIGIN] = envs.corsAllowedOrigins;
const FORBIDDEN_ORIGIN = 'https://attacker.example';
const PROBE_ROUTE = '/health';
const COUNTED_ROUTE = '/v1/user';
const REQUEST_ID_HEADER = 'x-request-id';
const THROTTLED_ACCOUNT = 'throttled@ex3.app';
const OTHER_ACCOUNT = 'other@ex3.app';
const PROBE_SESSION = 'probe-session-token';
const OWNER_ADDRESS = '192.0.2.10';
const ATTACKER_ADDRESS = '203.0.113.10';
const DISTRIBUTED_NETWORK = '198.51.100';
const MS_PER_SECOND = 1000;
const FORGED_PROXY_SECRET = 'forged-proxy-secret-that-the-api-does-not-share';
const OTHER_SESSION = 'other-session-token';
const CONCURRENT_EXCESS = 5;
const STORE_FAILURE = 'connection terminated unexpectedly';

const REMAINING_BUDGET = /r=(?<remaining>\d+)/;

const remainingBudgetOf = (res: request.Response) =>
  Number(REMAINING_BUDGET.exec(res.headers['ratelimit'])?.groups?.remaining);

const STATED_LIMIT = /q=(?<limit>\d+)/g;

const statedLimitsOf = (res: request.Response) =>
  [...String(res.headers['ratelimit-policy']).matchAll(STATED_LIMIT)].map(
    (match) => Number(match.groups?.limit)
  );

const vouchedFor = (address: string, secret = envs.apiProxySecret) => {
  assert.ok(secret, 'API_PROXY_SECRET must be set for the test environment');

  return {
    [ProxyHeaders.CLIENT_ADDRESS]: address,
    [ProxyHeaders.PROXY_SECRET]: secret
  };
};
const PROPAGATED_REQUEST_ID = 'b7c1d2e3-f4a5-4b6c-8d9e-0f1a2b3c4d5e';
const GENERATED_REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HTTP hardening', () => {
  let app: Express;

  registerIntegrationHooks();

  before(async () => {
    ({ app } = await import('./App'));
  });

  describe('CORS', () => {
    it('accepts an allowed origin', async () => {
      const res = await request(app)
        .get(PROBE_ROUTE)
        .set('Origin', ALLOWED_ORIGIN);

      assert.equal(res.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    });

    it('rejects an origin outside the allowlist', async () => {
      const res = await request(app)
        .get(PROBE_ROUTE)
        .set('Origin', FORBIDDEN_ORIGIN);

      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('rejects a preflight from an origin outside the allowlist', async () => {
      const res = await request(app)
        .options('/v1/asset')
        .set('Origin', FORBIDDEN_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
  });

  describe('security headers', () => {
    it('sets the headers provided by helmet', async () => {
      const res = await request(app).get(PROBE_ROUTE);

      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'DENY');
      assert.equal(
        res.headers['content-security-policy'],
        "default-src 'none';frame-ancestors 'none'"
      );
      assert.ok(res.headers['strict-transport-security']);
    });

    it('lets no cache keep an answer, whether it succeeded or failed', async () => {
      const answers = await Promise.all([
        request(app).get(PROBE_ROUTE),
        request(app).get(COUNTED_ROUTE),
        request(app).get('/v1/unknown-route')
      ]);

      for (const res of answers)
        assert.equal(res.headers['cache-control'], 'no-store');
    });

    it('does not advertise the server framework', async () => {
      const res = await request(app).get(PROBE_ROUTE);

      assert.equal(res.headers['x-powered-by'], undefined);
    });
  });

  describe('payload limit', () => {
    it('rejects a body larger than the configured limit', async () => {
      const oversizedBody = { symbol: 'A'.repeat(200 * 1024) };

      const res = await request(app)
        .post('/v1/user')
        .set('Content-Type', 'application/json')
        .send(oversizedBody);

      assert.equal(res.status, 413);
      assert.equal(res.status, Errors.PAYLOAD_TOO_LARGE.status);
      assert.equal(res.body.code, Errors.PAYLOAD_TOO_LARGE.code);
    });

    it('rejects malformed JSON as a bad request', async () => {
      const res = await request(app)
        .post('/v1/user')
        .set('Content-Type', 'application/json')
        .send('{"email":');

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.equal(res.body.code, Errors.VALIDATION.code);
    });

    it('keeps the documented limit below the oversized fixture', () => {
      assert.equal(RequestLimits.JSON_BODY_SIZE, '100kb');
    });
  });

  describe('error responses', () => {
    it('answers an unknown route with a structured not found', async () => {
      const res = await request(app).get('/v1/does-not-exist');

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.deepEqual(res.body, {
        code: Errors.NOT_FOUND.code,
        message: Errors.NOT_FOUND.message,
        details: []
      });
    });

    it('describes each rejected field of an invalid payload', async () => {
      const res = await request(app)
        .post('/v1/user')
        .send({ email: 'not-an-email', password: 'wrong-password' });

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.deepEqual(res.body, {
        code: Errors.VALIDATION.code,
        message: 'Email must be a valid email',
        details: [{ path: 'email', message: 'Email must be a valid email' }]
      });
    });

    it('reports an unanticipated failure as a generic internal error', async (t) => {
      t.mock.method(UserRepository.getInstance(), 'getByEmail', async () => {
        throw new Error('relation "users" does not exist');
      });

      const res = await request(app)
        .post('/v1/user')
        .send({ email: 'nobody@ex3.app', password: 'wrong-password' });

      assert.equal(res.status, Errors.INTERNAL.status);
      assert.deepEqual(res.body, {
        code: Errors.INTERNAL.code,
        message: Errors.INTERNAL.message,
        details: []
      });
    });

    it('never exposes a stack trace', async () => {
      const res = await request(app)
        .post('/v1/user')
        .set('Content-Type', 'application/json')
        .send('{"email":');

      assert.deepEqual(
        Object.keys(res.body).sort((a, b) => a.localeCompare(b)),
        ['code', 'details', 'message']
      );
      assert.ok(!JSON.stringify(res.body).includes('at '));
    });
  });

  describe('request correlation', () => {
    it('answers with an id of its own when the caller sent none', async () => {
      const res = await request(app).get(PROBE_ROUTE);

      assert.match(res.headers[REQUEST_ID_HEADER], GENERATED_REQUEST_ID);
    });

    it('echoes an id the caller propagated', async () => {
      const res = await request(app)
        .get(PROBE_ROUTE)
        .set(REQUEST_ID_HEADER, PROPAGATED_REQUEST_ID);

      assert.equal(res.headers[REQUEST_ID_HEADER], PROPAGATED_REQUEST_ID);
    });

    it('replaces an id outside the accepted shape', async () => {
      const forgedId = `${PROPAGATED_REQUEST_ID} "injected": true`;

      const res = await request(app)
        .get(PROBE_ROUTE)
        .set(REQUEST_ID_HEADER, forgedId);

      assert.match(res.headers[REQUEST_ID_HEADER], GENERATED_REQUEST_ID);
    });
  });

  describe('rate limiting', () => {
    const signInAs = (email: string, address = OWNER_ADDRESS) =>
      request(app)
        .post('/v1/user')
        .set(vouchedFor(address))
        .send({ email, password: 'wrong-password' });

    const failSignIns = async (
      attempts: number,
      signInAttempt: (attempt: number) => Promise<request.Response>
    ) => {
      for (let attempt = 0; attempt < attempts; attempt += 1)
        assert.equal(
          (await signInAttempt(attempt)).status,
          Errors.AUTHENTICATION.status
        );
    };

    it('throttles repeated failed sign-ins without saying which budget ran out', async () => {
      await failSignIns(RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS.limit, () =>
        signInAs(THROTTLED_ACCOUNT)
      );

      const throttled = await signInAs(THROTTLED_ACCOUNT);

      assert.equal(throttled.status, Errors.THROTTLED.status);
      assert.deepEqual(throttled.body, {
        code: Errors.THROTTLED.code,
        message: Errors.THROTTLED.message,
        details: []
      });
      assert.ok(Number(throttled.headers['retry-after']) > 0);
      assert.ok(
        Number(throttled.headers['retry-after']) <=
          RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS.windowMs / MS_PER_SECOND
      );
    });

    it('states no budget of the credential endpoints, only the general one', async () => {
      const signIn = await signInAs(THROTTLED_ACCOUNT);
      const signUp = await request(app)
        .post('/v1/user/create')
        .set(vouchedFor(OWNER_ADDRESS))
        .send({});

      for (const res of [signIn, signUp])
        assert.deepEqual(statedLimitsOf(res), [RateLimits.API.limit]);
    });

    it('keeps a throttled account open to other addresses and the address open to other accounts', async () => {
      await failSignIns(RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS.limit, () =>
        signInAs(THROTTLED_ACCOUNT, ATTACKER_ADDRESS)
      );

      const attacker = await signInAs(THROTTLED_ACCOUNT, ATTACKER_ADDRESS);
      const owner = await signInAs(THROTTLED_ACCOUNT, OWNER_ADDRESS);
      const otherAccount = await signInAs(OTHER_ACCOUNT, ATTACKER_ADDRESS);

      assert.equal(attacker.status, Errors.THROTTLED.status);
      assert.equal(owner.status, Errors.AUTHENTICATION.status);
      assert.equal(otherAccount.status, Errors.AUTHENTICATION.status);
    });

    it('caps failed sign-ins from one address across accounts', async () => {
      const sprayed = (attempt: number) => `sprayed-${attempt}@ex3.app`;

      await failSignIns(RateLimits.SIGN_IN_PER_ADDRESS.limit, (attempt) =>
        signInAs(sprayed(attempt), ATTACKER_ADDRESS)
      );

      const attacker = await signInAs(OTHER_ACCOUNT, ATTACKER_ADDRESS);
      const other = await signInAs(OTHER_ACCOUNT, OWNER_ADDRESS);

      assert.equal(attacker.status, Errors.THROTTLED.status);
      assert.equal(other.status, Errors.AUTHENTICATION.status);
    });

    it('caps failed sign-ins for one account across addresses', async () => {
      const distributedAddress = (attempt: number) =>
        `${DISTRIBUTED_NETWORK}.${attempt + 1}`;

      await failSignIns(RateLimits.SIGN_IN_PER_ACCOUNT.limit, (attempt) =>
        signInAs(THROTTLED_ACCOUNT, distributedAddress(attempt))
      );

      const unseenAddress = await signInAs(THROTTLED_ACCOUNT, OWNER_ADDRESS);
      const otherAccount = await signInAs(OTHER_ACCOUNT, OWNER_ADDRESS);

      assert.equal(unseenAddress.status, Errors.THROTTLED.status);
      assert.equal(otherAccount.status, Errors.AUTHENTICATION.status);
    });

    it('counts every sign-up attempt from one address, whatever it answers', async () => {
      const signUpFrom = (address: string) =>
        request(app).post('/v1/user/create').set(vouchedFor(address)).send({});

      for (
        let attempt = 0;
        attempt < RateLimits.SIGN_UP_PER_ADDRESS.limit;
        attempt += 1
      )
        assert.equal(
          (await signUpFrom(ATTACKER_ADDRESS)).status,
          Errors.VALIDATION.status
        );

      const attacker = await signUpFrom(ATTACKER_ADDRESS);
      const other = await signUpFrom(OWNER_ADDRESS);

      assert.equal(attacker.status, Errors.THROTTLED.status);
      assert.equal(other.status, Errors.VALIDATION.status);
    });

    const unvouchedClaims = {
      'without the secret': (address: string) => ({
        [ProxyHeaders.CLIENT_ADDRESS]: address
      }),
      'with a forged secret': (address: string) =>
        vouchedFor(address, FORGED_PROXY_SECRET),
      'that is not an IP address': () => vouchedFor('not-an-address')
    };

    for (const [claim, claimedHeadersFor] of Object.entries(unvouchedClaims))
      it(`counts a client address claimed ${claim} under the connecting address`, async () => {
        const signUpClaiming = (attempt: number) =>
          request(app)
            .post('/v1/user/create')
            .set(claimedHeadersFor(`${DISTRIBUTED_NETWORK}.${attempt + 1}`))
            .send({});

        for (
          let attempt = 0;
          attempt < RateLimits.SIGN_UP_PER_ADDRESS.limit;
          attempt += 1
        )
          assert.equal(
            (await signUpClaiming(attempt)).status,
            Errors.VALIDATION.status
          );

        const throttled = await signUpClaiming(
          RateLimits.SIGN_UP_PER_ADDRESS.limit
        );

        assert.equal(throttled.status, Errors.THROTTLED.status);
      });

    it('admits exactly the budget of concurrent failed sign-ins', async () => {
      const { limit } = RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS;

      const responses = await Promise.all(
        Array.from({ length: limit + CONCURRENT_EXCESS }, () =>
          signInAs(THROTTLED_ACCOUNT)
        )
      );
      const countOf = (status: number) =>
        responses.filter((res) => res.status === status).length;

      assert.equal(countOf(Errors.AUTHENTICATION.status), limit);
      assert.equal(countOf(Errors.THROTTLED.status), CONCURRENT_EXCESS);
    });

    it('enforces the failed sign-ins another API process counted', async () => {
      const { limit, windowMs } = RateLimits.SIGN_IN_PER_ACCOUNT;
      const otherProcess = new RateLimitStore({
        prefix: 'SIGN_IN_PER_ACCOUNT'
      });

      otherProcess.init({ windowMs });
      await Promise.all(
        Array.from({ length: limit }, () =>
          otherProcess.increment(accountRateLimitKey(THROTTLED_ACCOUNT))
        )
      );

      const throttled = await signInAs(THROTTLED_ACCOUNT);
      const otherAccount = await signInAs(OTHER_ACCOUNT);

      assert.equal(throttled.status, Errors.THROTTLED.status);
      assert.equal(otherAccount.status, Errors.AUTHENTICATION.status);
    });

    it('escalates an address that spent its daily sign-in budget', async () => {
      const { limit, windowMs } = RateLimits.SIGN_IN_PER_ADDRESS_DAILY;
      const otherProcess = new RateLimitStore({
        prefix: 'SIGN_IN_PER_ADDRESS_DAILY'
      });

      otherProcess.init({ windowMs });
      await Promise.all(
        Array.from({ length: limit }, () =>
          otherProcess.increment(addressRateLimitKey(ATTACKER_ADDRESS))
        )
      );

      const attacker = await signInAs(OTHER_ACCOUNT, ATTACKER_ADDRESS);
      const owner = await signInAs(OTHER_ACCOUNT, OWNER_ADDRESS);

      assert.equal(attacker.status, Errors.THROTTLED.status);
      assert.equal(owner.status, Errors.AUTHENTICATION.status);
    });

    it('keeps counting sign-ups against the day once the hourly window closes', async () => {
      const signUpFrom = (address: string) =>
        request(app).post('/v1/user/create').set(vouchedFor(address)).send({});
      const spendHourlyBudget = async () => {
        for (
          let attempt = 0;
          attempt < RateLimits.SIGN_UP_PER_ADDRESS.limit;
          attempt += 1
        )
          assert.equal(
            (await signUpFrom(ATTACKER_ADDRESS)).status,
            Errors.VALIDATION.status
          );
      };

      await spendHourlyBudget();
      await PrismaClient.getInstance().rateLimitCounter.updateMany({
        where: { key: { startsWith: 'SIGN_UP_PER_ADDRESS:' } },
        data: { resetAt: new Date(Date.now() - 1) }
      });
      await spendHourlyBudget();

      const attacker = await signUpFrom(ATTACKER_ADDRESS);
      const other = await signUpFrom(OWNER_ADDRESS);

      assert.equal(
        RateLimits.SIGN_UP_PER_ADDRESS_DAILY.limit,
        2 * RateLimits.SIGN_UP_PER_ADDRESS.limit
      );
      assert.equal(attacker.status, Errors.THROTTLED.status);
      assert.equal(other.status, Errors.VALIDATION.status);
    });

    it('refuses requests it cannot count instead of letting them through', async (t) => {
      t.mock.method(PrismaClient.prototype, '$queryRaw', () =>
        Promise.reject(new Error(STORE_FAILURE))
      );

      const api = await request(app).get(COUNTED_ROUTE);
      const signIn = await signInAs(THROTTLED_ACCOUNT);

      for (const res of [api, signIn]) {
        assert.equal(res.status, Errors.UNAVAILABLE.status);
        assert.deepEqual(res.body, {
          code: Errors.UNAVAILABLE.code,
          message: Errors.UNAVAILABLE.message,
          details: []
        });
      }
    });

    it('leaves the probes out of the budget', async () => {
      const res = await request(app).get(PROBE_ROUTE);

      assert.equal(res.status, 200);
      assert.equal(res.headers['ratelimit'], undefined);
    });

    it('counts API requests against the session, not across sessions', async () => {
      const probeAs = (session: string) =>
        request(app)
          .get(COUNTED_ROUTE)
          .set('Authorization', `Bearer ${session}`);

      await probeAs(PROBE_SESSION);
      const repeated = await probeAs(PROBE_SESSION);
      const other = await probeAs(OTHER_SESSION);

      assert.equal(remainingBudgetOf(repeated), RateLimits.API.limit - 2);
      assert.equal(remainingBudgetOf(other), RateLimits.API.limit - 1);
    });
  });
});
