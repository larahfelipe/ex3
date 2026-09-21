import type { DecimalString } from '@/types';

const LOCALE = 'en-US';

const PERCENT_FRACTION_DIGITS = 2;

const UNIT_AMOUNT_SIGNIFICANT_DIGITS = 4;

const QUOTE_TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const EXECUTION_TIME_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

/** A series day is a calendar day at midnight UTC, and a local zone would name the day before it. */
const SERIES_DAY_FORMAT = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeZone: 'UTC'
});

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

const decimalPlacesOf = (value: DecimalString) =>
  value.split('.').at(1)?.length ?? 0;

const currencyFractionDigits = (currency: string) =>
  numberFormatOf({ style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 0;

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

export const signedValueTone = (value: DecimalString) => {
  if (value === '0') return 'text-muted-foreground';

  return value.startsWith('-') ? 'text-negative' : 'text-positive';
};

export const formatQuoteTime = (timestamp: string) =>
  QUOTE_TIME_FORMAT.format(new Date(timestamp));

export const formatExecutionTime = (timestamp: string) =>
  EXECUTION_TIME_FORMAT.format(new Date(timestamp));

export const formatSeriesDay = (timestamp: string) =>
  SERIES_DAY_FORMAT.format(new Date(timestamp));

export const updateUrlQuery = (params: URLSearchParams) =>
  window.history.pushState(
    {},
    '',
    params.size ? `?${params}` : window.location.pathname
  );
