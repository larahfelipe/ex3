import { decimalPlacesOf } from '@/lib/decimal';
import type { DecimalString } from '@/types';

const LOCALE = 'en-US';

const PERCENT_FRACTION_DIGITS = 2;

const UNIT_AMOUNT_SIGNIFICANT_DIGITS = 4;

/**
 * Building a number formatter costs about forty times more than formatting with
 * one, and a table row builds several. The options are the cache key, and the
 * distinct keys are bounded by the styles, the currencies and the digit counts
 * the formatters below ask for.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();

const numberFormatOf = (options?: Intl.NumberFormatOptions) => {
  const key = JSON.stringify(options ?? null);
  const cached = numberFormats.get(key);

  if (cached !== undefined) return cached;

  const format = new Intl.NumberFormat(LOCALE, options);
  numberFormats.set(key, format);

  return format;
};

const formatNumber = (
  value: number | DecimalString,
  options?: Intl.NumberFormatOptions
) => numberFormatOf(options).format(value);

export const currencyFractionDigits = (currency: string) =>
  numberFormatOf({ style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 0;

/** The symbol `formatMoney` writes, so an amount field shows the one its figures do. */
export const currencySymbolOf = (currency: string) =>
  numberFormatOf({ style: 'currency', currency })
    .formatToParts(0)
    .find(({ type }) => type === 'currency')?.value ?? currency;

export const formatMoney = (
  value: DecimalString,
  currency: string,
  options?: Intl.NumberFormatOptions
) => formatNumber(value, { style: 'currency', currency, ...options });

export const formatPrice = (price: DecimalString, currency: string) =>
  formatMoney(price, currency, {
    maximumFractionDigits: Math.max(
      decimalPlacesOf(price),
      currencyFractionDigits(currency)
    )
  });

/** Keeps the amount of a unit below one cent, such as a crypto unit's price, from rounding to zero. */
export const formatUnitAmount = (amount: DecimalString, currency: string) =>
  formatMoney(amount, currency, {
    maximumSignificantDigits: UNIT_AMOUNT_SIGNIFICANT_DIGITS,
    roundingPriority: 'morePrecision'
  });

export const formatDecimal = (value: DecimalString, fractionDigits: number) =>
  formatNumber(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

export const formatQuantity = (quantity: DecimalString) =>
  formatNumber(quantity, { maximumFractionDigits: decimalPlacesOf(quantity) });

export const formatPercent = (
  fraction: DecimalString,
  options?: Intl.NumberFormatOptions
) =>
  formatNumber(fraction, {
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
