import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS, COOKIE_OPTIONS } from '@/common/constants';

import { getAccessTokenExpiration } from './access-token';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long after the token expires a return to a protected page still says the
 * session expired. Assumed, not measured: past a week the notice explains
 * nothing the user would miss.
 */
const SESSION_EXPIRY_NOTICE_MS = 7 * MILLISECONDS_PER_DAY;

/** The marker's presence is all that is read. */
const SESSION_MARKER_VALUE = '1';

/**
 * The token cookie is given the token's own lifetime so the browser stops
 * sending a credential the API would reject anyway. That leaves the proxy with
 * no cookie to tell an expired session from a sign-out, so a marker outlives
 * it, and only a sign-out or a password change clears the marker early.
 */
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

  cookieStore.delete(APP_STORAGE_KEYS.Token);
  cookieStore.delete(APP_STORAGE_KEYS.Session);
};
