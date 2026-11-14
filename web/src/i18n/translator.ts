import type { useTranslations } from 'use-intl';
import {
  createTranslator,
  type NamespaceKeys,
  type NestedKeyOf
} from 'use-intl/core';

import { APP_TIME_ZONE, type Locale } from './config';
import { messageFallbackOf, reportIntlError } from './errors';
import { MESSAGES, type Messages } from './messages';

export type Namespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

export type Translator<Scope extends Namespace = never> = ReturnType<
  typeof useTranslations<Scope>
>;

export const translatorOf = <Scope extends Namespace = never>(
  locale: Locale,
  namespace?: Scope
): Translator<Scope> =>
  createTranslator<Messages, Scope>({
    locale,
    timeZone: APP_TIME_ZONE,
    messages: MESSAGES[locale],
    namespace,
    onError: reportIntlError,
    getMessageFallback: messageFallbackOf
  });
