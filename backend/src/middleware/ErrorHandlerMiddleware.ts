import type { ErrorRequestHandler } from 'express';

import { Errors } from '@/config/Constants';
import { ApplicationError } from '@/errors';

type BodyParserError = Error & { type?: string; status?: number };

const toApplicationError = (e: unknown): ApplicationError => {
  if (e instanceof ApplicationError) return e;

  const { type, status } = (e ?? {}) as BodyParserError;

  if (type === 'entity.too.large')
    return new ApplicationError(
      Errors.PAYLOAD_TOO_LARGE.message,
      Errors.PAYLOAD_TOO_LARGE.status,
      Errors.PAYLOAD_TOO_LARGE.code
    );

  if (type === 'entity.parse.failed' || status === Errors.BAD_REQUEST.status)
    return new ApplicationError(
      Errors.BAD_REQUEST.message,
      Errors.BAD_REQUEST.status,
      Errors.BAD_REQUEST.code
    );

  return new ApplicationError(
    Errors.INTERNAL_SERVER_ERROR.message,
    Errors.INTERNAL_SERVER_ERROR.status,
    Errors.INTERNAL_SERVER_ERROR.code
  );
};

/**
 * Terminal error boundary. Only `code`, `message` and `details` cross the
 * wire — an unrecognised throw is reported as a generic internal error so that
 * stack traces and driver-level details never reach the client.
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

  const { status, code, message, details } = toApplicationError(e);

  if (status >= Errors.INTERNAL_SERVER_ERROR.status) console.error(e);

  res.status(status).json({ code, message, details });
};
