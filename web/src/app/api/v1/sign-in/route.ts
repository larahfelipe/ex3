import { type NextRequest, NextResponse } from 'next/server';

import api, { type ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';
import { setSessionCookie } from '@/lib/session';

import type { SignInRequestPayload, SignInResponseData, User } from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as SignInRequestPayload;

    const { data, status, statusText } = await api
      .getInstance()
      .post<User>('/v1/user', payload);

    const { accessToken, ...user } = data;

    if (accessToken) await setSessionCookie(accessToken);

    const res: SignInResponseData = user;

    return NextResponse.json<SignInResponseData>(res, { status, statusText });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
