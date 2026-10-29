import { useLocale } from 'use-intl';

import {
  currencyNameOf,
  currencySymbolOf,
  formatCompactMoney,
  formatDecimal,
  formatList,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatUnitAmount
} from '@/common/utils';
import {
  formatCalendarDay,
  formatCalendarMonth,
  formatExecutionDay,
  formatLongCalendarMonth,
  formatLongWeekdayCalendarDay,
  formatQuoteTime,
  formatSeriesDay,
  formatShortCalendarMonth,
  formatShortMonth,
  formatWeekdayCalendarDay,
  weekdayNames
} from '@/lib/dates';
import { decimalInputTextOf, readDecimal } from '@/lib/decimal';

import type { Locale } from './config';

/** Everything that writes or reads a number or a date in a language, each taking the locale first. */
const LOCALE_FORMATTERS = {
  currencyNameOf,
  currencySymbolOf,
  formatCompactMoney,
  formatDecimal,
  formatList,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatUnitAmount,
  formatCalendarDay,
  formatCalendarMonth,
  formatExecutionDay,
  formatLongCalendarMonth,
  formatLongWeekdayCalendarDay,
  formatQuoteTime,
  formatSeriesDay,
  formatShortCalendarMonth,
  formatShortMonth,
  formatWeekdayCalendarDay,
  weekdayNames,
  decimalInputTextOf,
  readDecimal
};

type LocaleFormatters = typeof LOCALE_FORMATTERS;

type WithoutLocale<Formatter> = Formatter extends (
  locale: Locale,
  ...args: infer Args
) => infer Result
  ? (...args: Args) => Result
  : never;

/** The formatters bound to one locale. */
export type Format = {
  readonly [Name in keyof LocaleFormatters]: WithoutLocale<
    LocaleFormatters[Name]
  >;
};

const formats = new Map<Locale, Format>();

/** The same object for the same locale, so it can sit in a hook's dependencies. */
export const formatOf = (locale: Locale): Format => {
  const cached = formats.get(locale);

  if (cached !== undefined) return cached;

  const format = Object.fromEntries(
    Object.entries(LOCALE_FORMATTERS).map(([name, formatter]) => [
      name,
      (...args: Array<never>) =>
        (formatter as (locale: Locale, ...rest: Array<never>) => unknown)(
          locale,
          ...args
        )
    ])
  ) as Format;

  formats.set(locale, format);

  return format;
};

/**
 * The formatters in the interface's current language. They come from the
 * provider's locale, so a component that uses them renders again when it
 * changes, and the server writes in the request's.
 */
export const useFormat = () => formatOf(useLocale());
