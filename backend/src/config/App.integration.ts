import type { Express } from 'express';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';

import { UserRepository } from '@/infra/database';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

import { Errors, RateLimits, RequestLimits } from './Constants';
import { envs } from './Envs';

const [ALLOWED_ORIGIN] = envs.corsAllowedOrigins;
const FORBIDDEN_ORIGIN = 'https://attacker.example';

describe('HTTP hardening', () => {
  let app: Express;

  registerIntegrationHooks();

  before(async () => {
    ({ app } = await import('./App'));
  });

  describe('CORS', () => {
    it('accepts an allowed origin', async () => {
      const res = await request(app)
        .get('/v1/assets')
        .set('Origin', ALLOWED_ORIGIN);

      assert.equal(res.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
    });

    it('rejects an origin outside the allowlist', async () => {
      const res = await request(app)
        .get('/v1/assets')
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
      const res = await request(app).get('/v1/assets');

      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.ok(res.headers['content-security-policy']);
      assert.ok(res.headers['strict-transport-security']);
    });

    it('does not advertise the server framework', async () => {
      const res = await request(app).get('/v1/assets');

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
      assert.equal(res.body.name, 'PayloadTooLargeError');
    });

    it('rejects malformed JSON as a bad request', async () => {
      const res = await request(app)
        .post('/v1/user')
        .set('Content-Type', 'application/json')
        .send('{"email":');

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.name, Errors.BAD_REQUEST.name);
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
        name: Errors.NOT_FOUND.name,
        message: Errors.NOT_FOUND.message
      });
    });

    it('reports an unanticipated failure as a generic internal error and logs it once', async (t) => {
      const driverFailure = new Error('relation "users" does not exist');
      t.mock.method(UserRepository.getInstance(), 'getByEmail', async () => {
        throw driverFailure;
      });
      const logged = t.mock.method(console, 'error', () => undefined);

      const res = await request(app)
        .post('/v1/user')
        .send({ email: 'nobody@ex3.app', password: 'wrong-password' });

      assert.equal(res.status, Errors.INTERNAL_SERVER_ERROR.status);
      assert.deepEqual(res.body, {
        name: Errors.INTERNAL_SERVER_ERROR.name,
        message: Errors.INTERNAL_SERVER_ERROR.message
      });
      assert.deepEqual(
        logged.mock.calls.map(({ arguments: logArguments }) => logArguments),
        [[driverFailure]]
      );
    });

    it('never exposes a stack trace', async () => {
      const res = await request(app)
        .post('/v1/user')
        .set('Content-Type', 'application/json')
        .send('{"email":');

      assert.deepEqual(Object.keys(res.body).sort(), ['message', 'name']);
      assert.ok(!JSON.stringify(res.body).includes('at '));
    });
  });

  describe('rate limiting', () => {
    it('throttles repeated attempts against the sign-in endpoint', async () => {
      const attempts = RateLimits.AUTH.limit + 1;
      const responses = [];

      for (let attempt = 0; attempt < attempts; attempt += 1)
        responses.push(
          await request(app)
            .post('/v1/user')
            .send({ email: 'nobody@ex3.app', password: 'wrong-password' })
        );

      const throttled = responses.at(-1);

      assert.equal(throttled?.status, Errors.TOO_MANY_REQUESTS.status);
      assert.equal(throttled?.body.name, Errors.TOO_MANY_REQUESTS.name);
    });

    it('budgets authentication more tightly than the rest of the API', () => {
      assert.ok(RateLimits.AUTH.limit < RateLimits.API.limit);
    });
  });
});
