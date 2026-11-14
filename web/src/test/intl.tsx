import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IntlProvider } from 'use-intl';
import type { IntlError } from 'use-intl/core';

import { APP_TIME_ZONE, DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { messageFallbackOf } from '@/i18n/errors';
import { MESSAGES } from '@/i18n/messages';

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&nbsp;': ' '
};

export const renderWithIntl = (
  node: ReactNode,
  locale: Locale = DEFAULT_LOCALE
) => {
  const errors: Array<IntlError> = [];
  const markup = renderToStaticMarkup(
    <IntlProvider
      locale={locale}
      timeZone={APP_TIME_ZONE}
      messages={MESSAGES[locale]}
      onError={(error) => errors.push(error)}
      getMessageFallback={messageFallbackOf}
    >
      {node}
    </IntlProvider>
  );

  if (errors.length > 0)
    throw new AggregateError(errors, errors.map(String).join('\n'));

  return markup;
};

export const textOf = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, (entity) => ENTITIES[entity] ?? entity);

/** `Intl` separates a currency or a unit from its figures with a no-break space. */
export const nbsp = (text: string) => text.replaceAll(' ', ' ');
