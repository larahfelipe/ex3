import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';

import { toApiProxyErrorResponse } from './api-error-response';
import api, { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from './axios';

type ForwardedRequest = {
  method: 'get' | 'post' | 'patch' | 'delete';
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
 * Cloud Run appends the address each connection comes from to
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

/** A body the proxy cannot parse is a rejected request, not an upstream failure. */
export const jsonPayload = async <Payload = unknown>(req: Request) => {
  try {
    return (await req.json()) as Payload;
  } catch {
    throw new ApiProxyError('Request body is not valid JSON', {
      status: 400,
      statusText: 'Bad Request'
    });
  }
};

export const forwardToApi = async <Data>({
  method,
  path,
  searchParams,
  payloadFrom
}: ForwardedRequest) => {
  try {
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
