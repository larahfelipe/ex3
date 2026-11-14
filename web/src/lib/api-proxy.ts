import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  APP_STORAGE_KEYS,
  BOT_CHALLENGE,
  REQUEST_LIMITS
} from '@/common/constants';

import { toApiProxyErrorResponse } from './api-error-response';
import api, { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from './axios';

type ForwardedRequest = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  searchParams?: URLSearchParams;
  payloadFrom?: Request;
  maxPayloadBytes?: number;
  timeoutMs?: number;
};

const authorizationHeaders = async () => {
  const accessToken = (await cookies()).get(APP_STORAGE_KEYS.Token)?.value;

  if (!accessToken)
    throw new ApiProxyError('Missing access token', {
      status: 401,
      statusText: 'Unauthorized'
    });

  return { Authorization: `Bearer ${accessToken}` };
};

const CLIENT_ADDRESS_HEADER = 'x-client-address';
const PROXY_SECRET_HEADER = 'x-api-proxy-secret';

/**
 * The runtime platform appends the address each connection comes from to
 * `X-Forwarded-For`, so only the last entry is the client's; any before it were
 * sent by the client itself. The API's `trust proxy` counts the same one hop.
 */
const clientAddressOf = (forwardedFor: string | null) =>
  forwardedFor?.split(',').at(-1)?.trim() ?? '';

/**
 * Every request reaches the API from this server, so a request that carries no
 * session names the client it serves, which the API believes only beside the
 * secret both share. Without it the API would count every visitor as one, so
 * production refuses to forward instead.
 */
export const clientAddressHeaders = async (): Promise<
  Record<string, string>
> => {
  const proxySecret = process.env.API_PROXY_SECRET;

  if (!proxySecret) {
    if (process.env.NODE_ENV !== 'production') return {};

    console.error(JSON.stringify({ event: 'api.proxy_secret_missing' }));

    throw new ApiProxyError(UNEXPECTED_ERROR_MESSAGE);
  }

  const clientAddress = clientAddressOf(
    (await headers()).get('x-forwarded-for')
  );

  return clientAddress
    ? {
        [CLIENT_ADDRESS_HEADER]: clientAddress,
        [PROXY_SECRET_HEADER]: proxySecret
      }
    : {};
};

export const botChallengeHeadersOf = (req: Request): Record<string, string> => {
  const token = req.headers.get(BOT_CHALLENGE.Header);

  return token && token.length <= BOT_CHALLENGE.TokenMaxLength
    ? { [BOT_CHALLENGE.Header]: token }
    : {};
};

const JSON_MEDIA_TYPE = 'application/json';

const isJsonRequest = (req: Request) =>
  req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ===
  JSON_MEDIA_TYPE;

const payloadTooLargeError = () =>
  new ApiProxyError('Request body is too large', {
    status: 413,
    statusText: 'Payload Too Large',
    _error: {
      code: 'VALIDATION',
      message: 'Request payload exceeds the maximum allowed size',
      details: []
    }
  });

const boundedTextOf = async (req: Request, maxBytes: number) => {
  if (Number(req.headers.get('content-length')) > maxBytes)
    throw payloadTooLargeError();

  if (req.body === null) return '';

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;

  for (
    let chunk = await reader.read();
    !chunk.done;
    chunk = await reader.read()
  ) {
    size += chunk.value.byteLength;

    if (size > maxBytes) {
      await reader.cancel();
      throw payloadTooLargeError();
    }

    text += decoder.decode(chunk.value, { stream: true });
  }

  return text + decoder.decode();
};

/**
 * A body the proxy cannot parse is a rejected request, not an upstream failure.
 * Only JSON is read: a form on another site can post text that parses as JSON,
 * but not under this media type without the browser asking first. A body past
 * `maxBytes` is refused as the API would refuse it, without the proxy holding
 * it whole.
 */
export const jsonPayload = async <Payload = unknown>(
  req: Request,
  maxBytes: number = REQUEST_LIMITS.JsonBodyBytes
) => {
  if (!isJsonRequest(req))
    throw new ApiProxyError('Request body is not JSON', {
      status: 415,
      statusText: 'Unsupported Media Type'
    });

  const text = await boundedTextOf(req, maxBytes);

  try {
    return JSON.parse(text) as Payload;
  } catch {
    throw new ApiProxyError('Request body is not valid JSON', {
      status: 400,
      statusText: 'Bad Request'
    });
  }
};

/**
 * `encodeURIComponent` leaves `.` and `..` as they are, and the upstream URL
 * resolves them, so an id of `..` would move the request onto another route:
 * voiding payment `..` would delete its expense. No id or symbol is only dots.
 */
const DOT_SEGMENT_PATTERN = /^(?:\.|%2e){1,2}$/i;

export const hasDotSegment = (path: string) =>
  path.split('/').some((segment) => DOT_SEGMENT_PATTERN.test(segment));

export const forwardToApi = async <Data>({
  method,
  path,
  searchParams,
  payloadFrom,
  maxPayloadBytes,
  timeoutMs
}: ForwardedRequest) => {
  try {
    if (hasDotSegment(path))
      throw new ApiProxyError('Request path is not valid', {
        status: 404,
        statusText: 'Not Found'
      });

    const { data, status, statusText } = await api.getInstance().request<Data>({
      method,
      url: path,
      headers: await authorizationHeaders(),
      params: searchParams,
      data: payloadFrom && (await jsonPayload(payloadFrom, maxPayloadBytes)),
      timeout: timeoutMs
    });

    return NextResponse.json<Data>(data, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
