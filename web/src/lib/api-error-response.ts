import { NextResponse } from 'next/server';

import {
  ApiProxyError,
  UNEXPECTED_ERROR_MESSAGE,
  type ApiProxyErrorData
} from './axios/errors';

/**
 * Only the fields of ApiProxyErrorData reach the browser: spreading the error
 * would also copy the AxiosError internals that carry the upstream request.
 */
export const toApiProxyErrorResponse = (e: unknown) => {
  const { message, _error, status, statusText } =
    e instanceof ApiProxyError
      ? e
      : new ApiProxyError(UNEXPECTED_ERROR_MESSAGE);

  return NextResponse.json<ApiProxyErrorData>(
    { message, _error },
    { status, statusText }
  );
};
