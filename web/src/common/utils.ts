import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { decimalPlacesOf } from '@/lib/decimal';
import type { DecimalString } from '@/types';

const PERCENT_FRACTION_DIGITS = 2;

const UNIT_AMOUNT_SIGNIFICANT_DIGITS = 4;

/**
 * Building a number formatter costs about forty times more than formatting with
 * one, and a table row builds several. The locale and the options are the
 * cache key, and the distinct keys are bounded by the locales, the styles, the
 * currencies and the digit counts the formatters below ask for.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();

const numberFormatOf = (locale: Locale, options?: Intl.NumberFormatOptions) => {
  const key = `${locale} ${JSON.stringify(options ?? null)}`;
  const cached = numberFormats.get(key);

  if (cached !== undefined) return cached;

  const format = new Intl.NumberFormat(locale, options);
  numberFormats.set(key, format);

  return format;
};

const formatNumber = (
  locale: Locale,
  value: number | DecimalString,
  options?: Intl.NumberFormatOptions
) => numberFormatOf(locale, options).format(value);

export const currencyFractionDigits = (currency: string) =>
  numberFormatOf(DEFAULT_LOCALE, {
    style: 'currency',
    currency
  }).resolvedOptions().maximumFractionDigits ?? 0;

export const currencySymbolOf = (locale: Locale, currency: string) =>
  numberFormatOf(locale, { style: 'currency', currency })
    .formatToParts(0)
    .find(({ type }) => type === 'currency')?.value ?? currency;

const currencyNames = new Map<Locale, Intl.DisplayNames>();

const conjunctionLists = new Map<Locale, Intl.ListFormat>();

export const currencyNameOf = (locale: Locale, currency: string) => {
  let names = currencyNames.get(locale);

  if (names === undefined) {
    names = new Intl.DisplayNames(locale, { type: 'currency' });
    currencyNames.set(locale, names);
  }

  return names.of(currency) ?? currency;
};

export const formatList = (locale: Locale, items: ReadonlyArray<string>) => {
  let list = conjunctionLists.get(locale);

  if (list === undefined) {
    list = new Intl.ListFormat(locale, { type: 'conjunction' });
    conjunctionLists.set(locale, list);
  }

  return list.format(items);
};

export const formatMoney = (
  locale: Locale,
  value: DecimalString,
  currency: string,
  options?: Intl.NumberFormatOptions
) => formatNumber(locale, value, { style: 'currency', currency, ...options });

export const formatCompactMoney = (
  locale: Locale,
  value: number | DecimalString,
  currency: string
) =>
  formatNumber(locale, value, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  });

export const formatPrice = (
  locale: Locale,
  price: DecimalString,
  currency: string
) =>
  formatMoney(locale, price, currency, {
    maximumFractionDigits: Math.max(
      decimalPlacesOf(price),
      currencyFractionDigits(currency)
    )
  });

export const formatUnitAmount = (
  locale: Locale,
  amount: DecimalString,
  currency: string
) =>
  formatMoney(locale, amount, currency, {
    maximumSignificantDigits: UNIT_AMOUNT_SIGNIFICANT_DIGITS,
    roundingPriority: 'morePrecision'
  });

export const formatDecimal = (
  locale: Locale,
  value: DecimalString,
  fractionDigits: number
) =>
  formatNumber(locale, value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

const BYTES_PER_KILOBYTE = 1024;

export const formatFileSize = (locale: Locale, bytes: number) => {
  const kilobytes = bytes / BYTES_PER_KILOBYTE;
  const [value, unit] =
    kilobytes < BYTES_PER_KILOBYTE
      ? [Math.max(kilobytes, 1), 'kilobyte']
      : [kilobytes / BYTES_PER_KILOBYTE, 'megabyte'];

  return formatNumber(locale, value, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1
  });
};

export const formatQuantity = (locale: Locale, quantity: DecimalString) =>
  formatNumber(locale, quantity, {
    maximumFractionDigits: decimalPlacesOf(quantity)
  });

export const formatPercent = (
  locale: Locale,
  fraction: number | DecimalString,
  options?: Intl.NumberFormatOptions
) =>
  formatNumber(locale, fraction, {
    style: 'percent',
    maximumFractionDigits: PERCENT_FRACTION_DIGITS,
    ...options
  });

export type ValueSign = 'negative' | 'zero' | 'positive';

export const signOf = (value: DecimalString): ValueSign => {
  if (value === '0') return 'zero';

  return value.startsWith('-') ? 'negative' : 'positive';
};

const SIGNED_VALUE_TONES: Record<ValueSign, string> = {
  negative: 'text-negative',
  zero: 'text-muted-foreground',
  positive: 'text-positive'
};

export const signedValueTone = (value: DecimalString) =>
  SIGNED_VALUE_TONES[signOf(value)];

export const updateUrlQuery = (params: URLSearchParams) =>
  window.history.pushState(
    {},
    '',
    params.size ? `?${params}` : window.location.pathname
  );
