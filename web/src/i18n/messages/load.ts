import type { Locale } from '../config';
import {
  asReferenceCatalog,
  type LocaleMessages,
  type Messages
} from './catalog';

/**
 * Each catalog in a chunk of its own: the page arrives with the request's
 * catalog, and the browser downloads another only when a person picks it.
 */
const CATALOG_LOADERS: Readonly<
  Record<Locale, () => Promise<Record<'default', LocaleMessages>>>
> = {
  'pt-BR': () => import('./pt-BR'),
  'en-US': () => import('./en-US')
};

export const loadMessages = async (locale: Locale): Promise<Messages> =>
  asReferenceCatalog((await CATALOG_LOADERS[locale]()).default);
