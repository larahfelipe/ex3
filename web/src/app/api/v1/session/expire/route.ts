import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';

import type { ExpireSessionResponseData } from '../types';

/**
 * Called once the API has rejected the session's token. The token cookie goes,
 * so the proxy stops letting a revoked token through, and the marker stays, so
 * a later redirect still tells an expiry apart from a sign-out. With neither
 * cookie left, the user ended the session, here or in another tab.
 */
export const POST = async () => {
  const cookieStore = await cookies();

  const res: ExpireSessionResponseData = {
    hasSessionExpired:
      cookieStore.has(APP_STORAGE_KEYS.Token) ||
      cookieStore.has(APP_STORAGE_KEYS.Session)
  };

  cookieStore.delete(APP_STORAGE_KEYS.Token);

  return NextResponse.json<ExpireSessionResponseData>(res, {
    status: 200,
    statusText: 'OK'
  });
};
