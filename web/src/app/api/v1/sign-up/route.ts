import { type NextRequest, NextResponse } from 'next/server';

import api, { type ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';
import { setSessionCookie } from '@/lib/session';
import type { WithMessage } from '@/types';

import type { User } from '../sign-in';
import type { SignUpRequestPayload, SignUpResponseData } from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as SignUpRequestPayload;

    const { data, status, statusText } = await api
      .getInstance()
      .post<User & WithMessage>('/v1/user/create', payload);

    const { accessToken, message, ...user } = data;

    if (accessToken) await setSessionCookie(accessToken);

    const res: SignUpResponseData = {
      user,
      message
    };

    return NextResponse.json<SignUpResponseData>(res, { status, statusText });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
