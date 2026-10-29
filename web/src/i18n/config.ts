/**
 * The locales the interface is translated into. Every one needs a complete
 * catalog under `messages/`, which the compiler checks against the default's.
 */
export const LOCALES = ['pt-BR', 'en-US'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** Each language in its own words, so a person finds theirs whatever language the interface is in. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (United States)'
};

/** The language alone, where the region would not fit, such as the sidebar; each one distinct. */
export const LOCALE_SHORT_NAMES: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Português',
  'en-US': 'English'
};

export const isSupportedLocale = (value: unknown): value is Locale =>
  LOCALES.some((locale) => locale === value);

/** Anything that is not a supported locale, such as a stale preference, reads as the default. */
export const resolveLocale = (candidate: unknown): Locale =>
  isSupportedLocale(candidate) ? candidate : DEFAULT_LOCALE;

/**
 * Messages take dates already written by `lib/dates`, so this zone applies
 * only to a date a message formats itself, such as a calendar day at its UTC
 * midnight. It is fixed, so the server and the browser write the same day.
 */
export const APP_TIME_ZONE = 'UTC';
