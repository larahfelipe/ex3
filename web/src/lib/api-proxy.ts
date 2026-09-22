import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';

import { toApiProxyErrorResponse } from './api-error-response';
import api, { ApiProxyError } from './axios';

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
