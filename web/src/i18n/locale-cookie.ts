import {
  APP_STORAGE_KEYS,
  PREFERENCE_MAX_AGE_SECONDS
} from '@/common/constants';

import type { Locale } from './config';

export const localeCookieOf = (locale: Locale) =>
  `${APP_STORAGE_KEYS.Locale}=${locale}; path=/; max-age=${PREFERENCE_MAX_AGE_SECONDS}; samesite=lax`;
