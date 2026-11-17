import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS, COOKIE_OPTIONS } from '@/common/constants';

import type { ExpireSessionResponseData } from '../types';

export const POST = async () => {
  const cookieStore = await cookies();

  const res: ExpireSessionResponseData = {
    hasSessionExpired:
      cookieStore.has(APP_STORAGE_KEYS.Token) ||
      cookieStore.has(APP_STORAGE_KEYS.Session)
  };

  cookieStore.delete({ ...COOKIE_OPTIONS, name: APP_STORAGE_KEYS.Token });

  return NextResponse.json<ExpireSessionResponseData>(res, {
    status: 200,
    statusText: 'OK'
  });
};
