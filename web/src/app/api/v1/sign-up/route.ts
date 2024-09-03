import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { COOKIE_OPTIONS, EX3_STORAGE_KEYS } from '@/common/constants';
import api, { type ApiError, type ApiErrorData } from '@/lib/axios';
import type { WithMessage } from '@/types';

import type { User } from '../sign-in';
import type { SignUpRequestPayload, SignUpResponseData } from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as SignUpRequestPayload;

    const { data, status, statusText } = await api.server.post<
      User & WithMessage
    >('/v1/user/create', payload);

    const { accessToken, message, ...user } = data;

    if (accessToken)
      cookies().set(EX3_STORAGE_KEYS.Token, accessToken, COOKIE_OPTIONS);

    return NextResponse.json<SignUpResponseData>(
      { user, message },
      { status, statusText }
    );
  } catch (e) {
    const { status, statusText, ...error } = e as ApiError;

    return NextResponse.json<ApiErrorData>(error, { status, statusText });
  }
};
