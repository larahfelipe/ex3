import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api from '@/lib/axios';

import type { SignOutResponseData } from './types';

export const POST = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(APP_STORAGE_KEYS.Token)?.value;

  /**
   * The cookie is cleared whatever the API answers: a client that cannot reach
   * the API must still be able to end its own session locally. A token the API
   * failed to revoke stops being accepted once it expires.
   */
  if (accessToken)
    await api
      .getInstance()
      .post('/v1/user/sign-out', undefined, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .catch(() => null);

  cookieStore.delete(APP_STORAGE_KEYS.Token);

  const res: SignOutResponseData = {
    success: true
  };

  return NextResponse.json<SignOutResponseData>(res, {
    status: 200,
    statusText: 'OK'
  });
};
