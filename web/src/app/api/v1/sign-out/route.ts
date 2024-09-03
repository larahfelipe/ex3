import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { EX3_STORAGE_KEYS } from '@/common/constants';

import type { SignOutResponseData } from './types';

export const POST = async () => {
  cookies().delete(EX3_STORAGE_KEYS.Token);

  return NextResponse.json<SignOutResponseData>({ success: true });
};
