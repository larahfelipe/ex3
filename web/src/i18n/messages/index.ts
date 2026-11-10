import type { Locale } from '../config';
import { asReferenceCatalog, type Messages } from './catalog';
import enUS from './en-US';
import ptBR from './pt-BR';

export type { LocaleMessages, Messages } from './catalog';

export const MESSAGES: Readonly<Record<Locale, Messages>> = {
  'pt-BR': ptBR,
  'en-US': asReferenceCatalog(enUS)
};
