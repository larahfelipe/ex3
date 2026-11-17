import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api from '@/lib/axios';
import { clearSessionCookies } from '@/lib/session';

import type { SignOutResponseData } from './types';

export const POST = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(APP_STORAGE_KEYS.Token)?.value;

  if (accessToken)
    await api
      .getInstance()
      .post('/v1/user/sign-out', undefined, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .catch(() => null);

  await clearSessionCookies();

  const res: SignOutResponseData = {
    success: true
  };

  return NextResponse.json<SignOutResponseData>(res, {
    status: 200,
    statusText: 'OK'
  });
};
