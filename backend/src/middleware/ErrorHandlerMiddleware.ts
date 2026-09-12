import type { ErrorRequestHandler } from 'express';

import { Errors } from '@/config/Constants';
import { ApplicationError } from '@/errors';

type BodyParserError = Error & { type?: string; status?: number };

const PAYLOAD_TOO_LARGE_STATUS = 413;

const toApplicationError = (e: unknown): ApplicationError => {
  if (e instanceof ApplicationError) return e;

  const { type, status } = (e ?? {}) as BodyParserError;

  if (type === 'entity.too.large')
    return new ApplicationError(
      'Request payload exceeds the maximum allowed size',
      PAYLOAD_TOO_LARGE_STATUS,
      'PayloadTooLargeError'
    );

  if (type === 'entity.parse.failed' || status === Errors.BAD_REQUEST.status)
    return new ApplicationError(
      Errors.BAD_REQUEST.message,
      Errors.BAD_REQUEST.status,
      Errors.BAD_REQUEST.name
    );

  return new ApplicationError(
    Errors.INTERNAL_SERVER_ERROR.message,
    Errors.INTERNAL_SERVER_ERROR.status,
    Errors.INTERNAL_SERVER_ERROR.name
  );
};

/**
 * Terminal error boundary. Only `name` and `message` cross the wire — an
 * unrecognised throw is reported as a generic internal error so that stack
 * traces and driver-level details never reach the client.
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  e,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    next(e);
    return;
  }

  const { status, name, message } = toApplicationError(e);

  if (status >= Errors.INTERNAL_SERVER_ERROR.status) console.error(e);

  res.status(status).json({ name, message });
};
