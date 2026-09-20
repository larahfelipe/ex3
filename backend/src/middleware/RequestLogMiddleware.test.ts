import type { NextFunction, Request, Response } from 'express';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LogEntry } from '@/infra/observability';

import { createRequestLogMiddleware } from './RequestLogMiddleware';

const REQUEST_ID_HEADER = 'x-request-id';
const PROPAGATED_ID = 'b7c1d2e3-f4a5-4b6c-8d9e-0f1a2b3c4d5e';
const USER_ID = '0f2f5a3c-2c1c-4f2a-9a1a-7c6f5d4e3b2a';

type RequestOverrides = Partial<
  Pick<Request, 'method' | 'baseUrl' | 'user'>
> & {
  /** `null` stands for the request Express matched no route for. */
  route?: Record<'path', string> | null;
  requestIdHeader?: string;
};

const makeRequest = ({
  method = 'GET',
  baseUrl = '',
  route = { path: '/v1/portfolio/positions' },
  user,
  requestIdHeader
}: RequestOverrides = {}) =>
  ({
    method,
    baseUrl,
    route: route ?? undefined,
    user,
    get: (name: string) =>
      name.toLowerCase() === REQUEST_ID_HEADER ? requestIdHeader : undefined
  }) as unknown as Request;

const makeResponse = (statusCode = 200) => {
  const headers = new Map<string, string>();
  const finishListeners: Array<() => void> = [];

  const res = {
    statusCode,
    setHeader: (name: string, value: string) => headers.set(name, value),
    on: (event: string, listener: () => void) => {
      if (event === 'finish') finishListeners.push(listener);

      return res;
    }
  } as unknown as Response;

  return {
    res,
    headers,
    finish: () => finishListeners.forEach((listener) => listener())
  };
};

const run = (
  request: Request,
  response: ReturnType<typeof makeResponse>,
  entries: LogEntry[]
) => {
  const next = (() => undefined) as NextFunction;

  createRequestLogMiddleware((entry) => entries.push(entry))(
    request,
    response.res,
    next
  );
  response.finish();
};

describe('requestLogMiddleware', () => {
  it('writes the route pattern, the status, the duration and the signed-in user', () => {
    const entries: LogEntry[] = [];
    const req = makeRequest({
      baseUrl: '/v1/portfolio',
      route: { path: '/positions' },
      user: { id: USER_ID } as Request['user']
    });
    const response = makeResponse();

    run(req, response, entries);

    const [entry] = entries;

    assert.equal(entries.length, 1);
    assert.partialDeepStrictEqual(entry, {
      severity: 'INFO',
      event: 'http_request',
      method: 'GET',
      route: '/v1/portfolio/positions',
      status: 200,
      userId: USER_ID
    });
    assert.ok(
      'durationMs' in entry && typeof entry.durationMs === 'number',
      'the entry reports how long the request took'
    );
  });

  it('reuses a propagated id and echoes it back', () => {
    const entries: LogEntry[] = [];
    const response = makeResponse();

    run(makeRequest({ requestIdHeader: PROPAGATED_ID }), response, entries);

    assert.equal(response.headers.get(REQUEST_ID_HEADER), PROPAGATED_ID);
    assert.partialDeepStrictEqual(entries[0], { requestId: PROPAGATED_ID });
  });

  it('replaces a propagated id outside the accepted shape', () => {
    const entries: LogEntry[] = [];
    const forgedId = 'x'.repeat(200);
    const response = makeResponse();

    run(makeRequest({ requestIdHeader: forgedId }), response, entries);

    const echoedId = response.headers.get(REQUEST_ID_HEADER);

    assert.notEqual(echoedId, forgedId);
    assert.partialDeepStrictEqual(entries[0], { requestId: echoedId });
  });

  it('reports a request that matched no route, with the code it was answered with', () => {
    const entries: LogEntry[] = [];
    const req = makeRequest({ route: null });
    const response = makeResponse(404);

    req.errorCode = 'NOT_FOUND';

    run(req, response, entries);

    assert.partialDeepStrictEqual(entries[0], {
      severity: 'WARNING',
      route: 'unmatched',
      status: 404,
      errorCode: 'NOT_FOUND'
    });
  });

  it('leaves the user out of a request that was never authenticated', () => {
    const entries: LogEntry[] = [];

    run(makeRequest(), makeResponse(), entries);

    assert.equal('userId' in entries[0] && entries[0].userId, undefined);
  });
});
