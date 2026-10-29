import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS } from '@/common/constants';

import { resolveLocale } from './config';
import { translatorOf, type Namespace } from './translator';

/** The language the request asked for through its cookie, or the default when it names none the app has. */
export const getRequestLocale = async () =>
  resolveLocale((await cookies()).get(APP_STORAGE_KEYS.Locale)?.value);

/** A translator in the request's language, for a server component or a page's metadata. */
export const getServerTranslator = async <Scope extends Namespace = never>(
  namespace?: Scope
) => translatorOf<Scope>(await getRequestLocale(), namespace);
