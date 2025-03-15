import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS, COOKIE_OPTIONS } from '@/common/constants';
import api, { type ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';
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

    if (accessToken)
      cookies().set(APP_STORAGE_KEYS.Token, accessToken, COOKIE_OPTIONS);

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
