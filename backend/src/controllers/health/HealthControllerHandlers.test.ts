import type { NextFunction, Request, Response } from 'express';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Errors } from '@/config/Constants';
import type { LogEntry } from '@/infra/observability';

import {
  createReadinessControllerHandler,
  livenessControllerHandler
} from './HealthControllerHandlers';

const DATABASE_FAILURE = 'Connection terminated unexpectedly';

const makeResponse = () => {
  const sent: Array<Record<'status', number> & Record<'body', unknown>> = [];
  let status = 0;

  const res = {
    status: (code: number) => {
      status = code;

      return res;
    },
    json: (body: unknown) => {
      sent.push({ status, body });

      return res;
    }
  } as unknown as Response;

  return { res, sent };
};

const runReadiness = async (reason: string | undefined) => {
  const entries: LogEntry[] = [];
  const req = {} as Request;
  const { res, sent } = makeResponse();
  let probeCount = 0;

  await createReadinessControllerHandler(
    async () => {
      probeCount += 1;

      return reason;
    },
    (entry) => entries.push(entry)
  )(req, res, (() => undefined) as NextFunction);

  return { entries, probeCount, req, sent };
};

describe('livenessControllerHandler', () => {
  it('answers that the process is running without reaching a dependency', () => {
    const { res, sent } = makeResponse();

    livenessControllerHandler({} as Request, res);

    assert.deepEqual(sent, [{ status: 200, body: { status: 'alive' } }]);
  });
});

describe('readinessControllerHandler', () => {
  it('reports the instance ready when the database answers', async () => {
    const { sent, entries, probeCount, req } = await runReadiness(undefined);

    assert.deepEqual(sent, [
      { status: 200, body: { status: 'ready', database: 'up' } }
    ]);
    assert.equal(probeCount, 1);
    assert.equal(req.errorCode, undefined);
    assert.deepEqual(entries, []);
  });

  it('answers the unavailable envelope when the database does not', async () => {
    const { sent, req } = await runReadiness(DATABASE_FAILURE);

    assert.equal(req.errorCode, Errors.UNAVAILABLE.code);
    assert.deepEqual(sent, [
      {
        status: Errors.UNAVAILABLE.status,
        body: {
          code: Errors.UNAVAILABLE.code,
          message: Errors.UNAVAILABLE.message,
          details: []
        }
      }
    ]);
  });

  it('reports which dependency failed, and why, to the log alone', async () => {
    const { sent, entries } = await runReadiness(DATABASE_FAILURE);

    assert.partialDeepStrictEqual(entries, [
      {
        severity: 'WARNING',
        event: 'dependency_unavailable',
        dependency: 'database',
        reason: DATABASE_FAILURE
      }
    ]);
    assert.ok(!JSON.stringify(sent).includes(DATABASE_FAILURE));
  });
});
