export const LOCALES = ['pt-BR', 'en-US'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (United States)'
};

export const LOCALE_SHORT_NAMES: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Português',
  'en-US': 'English'
};

export const isSupportedLocale = (value: unknown): value is Locale =>
  LOCALES.some((locale) => locale === value);

export const resolveLocale = (candidate: unknown): Locale =>
  isSupportedLocale(candidate) ? candidate : DEFAULT_LOCALE;

export const APP_TIME_ZONE = 'UTC';
