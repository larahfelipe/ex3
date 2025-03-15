import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';

import type { SignOutResponseData } from './types';

export const POST = async () => {
  cookies().delete(APP_STORAGE_KEYS.Token);

  const res: SignOutResponseData = {
    success: true
  };

  return NextResponse.json<SignOutResponseData>(res, {
    status: 200,
    statusText: 'OK'
  });
};
