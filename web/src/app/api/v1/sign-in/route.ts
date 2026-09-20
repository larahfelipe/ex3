import { type NextRequest, NextResponse } from 'next/server';

import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import { jsonPayload } from '@/lib/api-proxy';
import api from '@/lib/axios';
import { setSessionCookie } from '@/lib/session';

import type { SignInRequestPayload, SignInResponseData, User } from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = await jsonPayload<SignInRequestPayload>(req);

    const { data, status, statusText } = await api
      .getInstance()
      .post<User>('/v1/user', payload);

    const { accessToken, ...user } = data;

    if (accessToken) await setSessionCookie(accessToken);

    const res: SignInResponseData = user;

    return NextResponse.json<SignInResponseData>(res, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
