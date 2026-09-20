import type { Express } from 'express';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import request from 'supertest';

import { Errors } from '@/config/Constants';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const DATABASE_FAILURE = 'Connection terminated unexpectedly';

describe('health', () => {
  let app: Express;

  registerIntegrationHooks();

  before(async () => {
    ({ app } = await import('@/config/App'));
  });

  describe('GET /health', () => {
    it('answers that the process is running, to a caller without a session', async () => {
      const res = await request(app).get('/health');

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'alive' });
    });

    it('answers while the database is unreachable', async (t) => {
      t.mock.method(PrismaClient.prototype, '$queryRaw', () => {
        throw new Error(DATABASE_FAILURE);
      });

      const res = await request(app).get('/health');

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'alive' });
    });
  });

  describe('GET /ready', () => {
    it('answers that the instance can serve, to a caller without a session', async () => {
      const res = await request(app).get('/ready');

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { status: 'ready', database: 'up' });
    });

    it('answers unavailable while the database does not, without naming the failure', async (t) => {
      t.mock.method(PrismaClient.prototype, '$queryRaw', () => {
        throw new Error(DATABASE_FAILURE);
      });

      const res = await request(app).get('/ready');

      assert.equal(res.status, Errors.UNAVAILABLE.status);
      assert.deepEqual(res.body, {
        code: Errors.UNAVAILABLE.code,
        message: Errors.UNAVAILABLE.message,
        details: []
      });
      assert.ok(!JSON.stringify(res.body).includes(DATABASE_FAILURE));
    });

    it('reports itself ready again once the database answers', async (t) => {
      const probe = t.mock.method(PrismaClient.prototype, '$queryRaw', () => {
        throw new Error(DATABASE_FAILURE);
      });

      const whileDown = await request(app).get('/ready');

      probe.mock.restore();

      const afterRecovery = await request(app).get('/ready');

      assert.equal(whileDown.status, Errors.UNAVAILABLE.status);
      assert.equal(afterRecovery.status, 200);
    });
  });
});
