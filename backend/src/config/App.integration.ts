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
const REQUEST_ID_HEADER = 'x-request-id';
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
      const res = await request(app).get('/v1/assets');

      assert.match(res.headers[REQUEST_ID_HEADER], GENERATED_REQUEST_ID);
    });

    it('echoes an id the caller propagated', async () => {
      const res = await request(app)
        .get('/v1/assets')
        .set(REQUEST_ID_HEADER, PROPAGATED_REQUEST_ID);

      assert.equal(res.headers[REQUEST_ID_HEADER], PROPAGATED_REQUEST_ID);
    });

    it('replaces an id outside the accepted shape', async () => {
      const forgedId = `${PROPAGATED_REQUEST_ID} "injected": true`;

      const res = await request(app)
        .get('/v1/assets')
        .set(REQUEST_ID_HEADER, forgedId);

      assert.match(res.headers[REQUEST_ID_HEADER], GENERATED_REQUEST_ID);
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

      assert.equal(throttled?.status, Errors.THROTTLED.status);
      assert.deepEqual(throttled?.body, {
        code: Errors.THROTTLED.code,
        message: Errors.THROTTLED.message,
        details: []
      });
    });

    it('budgets authentication more tightly than the rest of the API', () => {
      assert.ok(RateLimits.AUTH.limit < RateLimits.API.limit);
    });
  });
});
