import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS, COOKIE_OPTIONS } from '@/common/constants';

import { getAccessTokenExpiration } from './access-token';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const SESSION_EXPIRY_NOTICE_MS = 7 * MILLISECONDS_PER_DAY;

const SESSION_MARKER_VALUE = '1';

export const setSessionCookies = async (accessToken: string) => {
  const cookieStore = await cookies();
  const expiresAt = getAccessTokenExpiration(accessToken);

  cookieStore.set(APP_STORAGE_KEYS.Token, accessToken, {
    ...COOKIE_OPTIONS,
    expires: expiresAt ?? undefined
  });
  cookieStore.set(APP_STORAGE_KEYS.Session, SESSION_MARKER_VALUE, {
    ...COOKIE_OPTIONS,
    expires: new Date(
      (expiresAt?.getTime() ?? Date.now()) + SESSION_EXPIRY_NOTICE_MS
    )
  });
};

export const clearSessionCookies = async () => {
  const cookieStore = await cookies();

  cookieStore.delete({ ...COOKIE_OPTIONS, name: APP_STORAGE_KEYS.Token });
  cookieStore.delete({ ...COOKIE_OPTIONS, name: APP_STORAGE_KEYS.Session });
};
