import {
  APP_STORAGE_KEYS,
  PREFERENCE_MAX_AGE_SECONDS
} from '@/common/constants';

import type { Locale } from './config';

/**
 * The language preference as `document.cookie` takes it. The server reads it
 * to render every page, so it is sent on every path; it outlives the session,
 * since signing out keeps the preferences of the browser.
 */
export const localeCookieOf = (locale: Locale) =>
  `${APP_STORAGE_KEYS.Locale}=${locale}; path=/; max-age=${PREFERENCE_MAX_AGE_SECONDS}; samesite=lax`;
