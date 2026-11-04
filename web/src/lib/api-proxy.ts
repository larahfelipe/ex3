import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS, BOT_CHALLENGE } from '@/common/constants';

import { toApiProxyErrorResponse } from './api-error-response';
import api, { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from './axios';

type ForwardedRequest = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  searchParams?: URLSearchParams;
  payloadFrom?: Request;
};

/** The browser never holds the token: it is read from the httpOnly cookie and sent only to the API. */
const authorizationHeaders = async () => {
  const accessToken = (await cookies()).get(APP_STORAGE_KEYS.Token)?.value;

  if (!accessToken)
    throw new ApiProxyError('Missing access token', {
      status: 401,
      statusText: 'Unauthorized'
    });

  return { Authorization: `Bearer ${accessToken}` };
};

/** Mirror of the API's `ProxyHeaders`. */
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

/**
 * The browser's Turnstile token, passed on as sent for the API to verify. One
 * longer than Cloudflare issues is dropped here, so the API refuses it as
 * missing without the proxy forwarding an oversized header.
 */
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

/**
 * A body the proxy cannot parse is a rejected request, not an upstream failure.
 * Only JSON is read: a form on another site can post text that parses as JSON,
 * but not under this media type without the browser asking first.
 */
export const jsonPayload = async <Payload = unknown>(req: Request) => {
  if (!isJsonRequest(req))
    throw new ApiProxyError('Request body is not JSON', {
      status: 415,
      statusText: 'Unsupported Media Type'
    });

  try {
    return (await req.json()) as Payload;
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
  payloadFrom
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
      data: payloadFrom && (await jsonPayload(payloadFrom))
    });

    return NextResponse.json<Data>(data, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
