import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS } from '@/common/constants';

import { resolveLocale } from './config';
import { translatorOf, type Namespace } from './translator';

export const getRequestLocale = async () =>
  resolveLocale((await cookies()).get(APP_STORAGE_KEYS.Locale)?.value);

export const getServerTranslator = async <Scope extends Namespace = never>(
  namespace?: Scope
) => translatorOf<Scope>(await getRequestLocale(), namespace);
