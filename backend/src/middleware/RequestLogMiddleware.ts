import type { Request, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

import { log, severityOfStatus, type LogSink } from '@/infra/observability';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * An id that arrives with the request is echoed back and written to every line
 * it produces, so it is only reused in the shape this service itself generates.
 */
const PROPAGATED_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

const UNMATCHED_ROUTE = 'unmatched';

/** The pattern, never the path: `/v1/assets/:symbol` groups, `/v1/assets/AAPL` does not. */
const routeOf = (req: Request) =>
  typeof req.route?.path === 'string'
    ? `${req.baseUrl}${req.route.path}`
    : UNMATCHED_ROUTE;

const requestIdOf = (req: Request) => {
  const propagated = req.get(REQUEST_ID_HEADER);

  return propagated !== undefined && PROPAGATED_REQUEST_ID.test(propagated)
    ? propagated
    : randomUUID();
};

/**
 * One line per completed request, written after the error boundary has run so
 * that it carries the code the client was answered with. The signed-in user is
 * identified by id alone: no e-mail, no token, nothing the log should not keep.
 */
export const createRequestLogMiddleware =
  (logEntry: LogSink = log): RequestHandler =>
  (req, res, next) => {
    const requestId = requestIdOf(req);
    const startedAt = performance.now();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    res.on('finish', () =>
      logEntry({
        severity: severityOfStatus(res.statusCode),
        event: 'http_request',
        requestId,
        method: req.method,
        route: routeOf(req),
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        userId: req.user?.id,
        errorCode: req.errorCode
      })
    );

    next();
  };

export const requestLogMiddleware = createRequestLogMiddleware();
