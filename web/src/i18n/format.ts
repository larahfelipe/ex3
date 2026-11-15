import { useLocale } from 'use-intl';

import {
  currencyNameOf,
  currencySymbolOf,
  formatCompactMoney,
  formatDecimal,
  formatFileSize,
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
  formatNarrowCalendarMonth,
  formatQuoteTime,
  formatSeriesDay,
  formatShortCalendarMonth,
  formatShortMonth,
  formatWeekdayCalendarDay,
  weekdayNames
} from '@/lib/dates';
import { decimalInputTextOf, readDecimal } from '@/lib/decimal';

import type { Locale } from './config';

const LOCALE_FORMATTERS = {
  currencyNameOf,
  currencySymbolOf,
  formatCompactMoney,
  formatDecimal,
  formatFileSize,
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
  formatNarrowCalendarMonth,
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

export const useFormat = () => formatOf(useLocale());
