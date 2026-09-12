import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS, COOKIE_OPTIONS } from '@/common/constants';

import { getAccessTokenExpiration } from './access-token';

/**
 * The cookie is given the token's own lifetime so the browser stops sending a
 * credential the API would reject anyway.
 */
export const setSessionCookie = async (accessToken: string) =>
  (await cookies()).set(APP_STORAGE_KEYS.Token, accessToken, {
    ...COOKIE_OPTIONS,
    expires: getAccessTokenExpiration(accessToken) ?? undefined
  });
