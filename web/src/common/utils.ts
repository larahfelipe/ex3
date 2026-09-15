import type { DecimalString } from '@/types';

const PERCENT_FRACTION_DIGITS = 2;

const QUOTE_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export const formatNumber = (
  value: number | DecimalString,
  options?: Intl.NumberFormatOptions
) => new Intl.NumberFormat('en-US', options).format(value);

const decimalPlacesOf = (value: DecimalString) =>
  value.split('.').at(1)?.length ?? 0;

const currencyFractionDigits = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).resolvedOptions().maximumFractionDigits ?? 0;

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
  if (value === '0') return 'text-gray-300';

  return value.startsWith('-') ? 'text-red-600' : 'text-green-600';
};

export const formatQuoteTime = (timestamp: string) =>
  QUOTE_TIME_FORMAT.format(new Date(timestamp));

export const replaceUrl = (href: string) =>
  window.history.pushState({}, '', href);

export const truncateText = (
  text: string,
  maxLength: number,
  suffix = '...'
) => {
  if (text.length <= maxLength) return text;
  const charsToShow = maxLength - suffix.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  return (
    text.substring(0, frontChars) +
    suffix +
    text.substring(text.length - backChars)
  );
};

export const sanitizeInputValue = (
  value: string,
  inputType: 'text' | 'number' | 'alphanumeric',
  options?: {
    allowSpaces?: boolean;
    allowHyphens?: boolean;
    allowSpecialChars?: boolean;
  }
) => {
  if (!value?.length) return value;
  const sanitizeWithRegex = (regex: RegExp) => value.replace(regex, '');
  switch (inputType) {
    case 'text':
      return sanitizeWithRegex(
        new RegExp(
          `[^a-zA-ZÀ-ž${options?.allowSpaces ? '\\s' : ''}${options?.allowHyphens ? '-' : ''}${options?.allowSpecialChars ? '!@#\\$%&\\*\\(\\)_\\+\\.,' : ''}]`,
          'g'
        )
      );
    case 'number':
      return sanitizeWithRegex(/\D/g);
    case 'alphanumeric':
      return sanitizeWithRegex(
        new RegExp(
          `[^a-zA-ZÀ-ž0-9${options?.allowSpaces ? '\\s' : ''}${options?.allowHyphens ? '-' : ''}${options?.allowSpecialChars ? '!@#\\$%&\\*\\(\\)_\\+\\.,' : ''}]`,
          'g'
        )
      );
    default:
      console.warn(`Unknown inputType: ${inputType}`);
      return value;
  }
};
