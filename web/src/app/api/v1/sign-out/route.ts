import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';

import type { SignOutResponseData } from './types';

export const POST = async () => {
  cookies().delete(APP_STORAGE_KEYS.Token);

  return NextResponse.json<SignOutResponseData>({ success: true });
};
