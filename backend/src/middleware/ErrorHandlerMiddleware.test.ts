import type { NextFunction, Request, Response } from 'express';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Errors } from '@/config/Constants';
import { ValidationError } from '@/errors';
import type { LogEntry } from '@/infra/observability';

import { createErrorHandlerMiddleware } from './ErrorHandlerMiddleware';

const REQUEST_ID = 'b7c1d2e3-f4a5-4b6c-8d9e-0f1a2b3c4d5e';

const makeRequest = () => ({ requestId: REQUEST_ID }) as Request;

const makeResponse = (headersSent = false) => {
  const sent: Array<Record<'status', number> & Record<'body', unknown>> = [];
  let status = 0;

  const res = {
    headersSent,
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

const run = (e: unknown, response = makeResponse()) => {
  const entries: LogEntry[] = [];
  const req = makeRequest();
  const forwarded: Array<unknown> = [];
  const next = ((error?: unknown) => forwarded.push(error)) as NextFunction;

  createErrorHandlerMiddleware((entry) => entries.push(entry))(
    e,
    req,
    response.res,
    next
  );

  return { entries, forwarded, req, sent: response.sent };
};

describe('errorHandlerMiddleware', () => {
  it('answers an application error with its own status and records the code on the request', () => {
    const { sent, req, entries } = run(
      new ValidationError('Email must be a valid email', [
        { path: 'email', message: 'Email must be a valid email' }
      ])
    );

    assert.deepEqual(sent, [
      {
        status: Errors.VALIDATION.status,
        body: {
          code: Errors.VALIDATION.code,
          message: 'Email must be a valid email',
          details: [{ path: 'email', message: 'Email must be a valid email' }]
        }
      }
    ]);
    assert.equal(req.errorCode, Errors.VALIDATION.code);
    assert.deepEqual(entries, []);
  });

  it('reports an unanticipated failure as a generic internal error and logs it once', () => {
    const driverFailure = new Error('relation "users" does not exist');

    const { sent, entries } = run(driverFailure);

    assert.deepEqual(sent, [
      {
        status: Errors.INTERNAL.status,
        body: {
          code: Errors.INTERNAL.code,
          message: Errors.INTERNAL.message,
          details: []
        }
      }
    ]);
    assert.equal(entries.length, 1);
    assert.partialDeepStrictEqual(entries[0], {
      severity: 'ERROR',
      event: 'request_failed',
      requestId: REQUEST_ID,
      errorName: 'Error',
      errorMessage: 'relation "users" does not exist'
    });
  });

  it('describes a throw that is not an error', () => {
    const { entries } = run('database exploded');

    assert.partialDeepStrictEqual(entries[0], {
      errorName: 'NonError',
      errorMessage: 'database exploded',
      stack: undefined
    });
  });

  it('forwards the failure when the response has already started', () => {
    const response = makeResponse(true);
    const failure = new Error('too late');

    const { sent, forwarded, entries } = run(failure, response);

    assert.deepEqual(sent, []);
    assert.deepEqual(forwarded, [failure]);
    assert.deepEqual(entries, []);
  });
});
