import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';

import type { Locale } from '@/i18n/config';

/**
 * The API takes and returns instants as ISO 8601 and stores them in UTC; a day
 * of a performance series is its midnight UTC. Every date the web reads,
 * converts or shows passes through here: an instant in the browser's zone, a
 * series day in UTC. dayjs reads and counts; `Intl` writes, in the locale each
 * formatter takes first, which `useFormat` (`@/i18n/format`) binds.
 */

dayjs.extend(customParseFormat);
dayjs.extend(utc);

export const CALENDAR_DAY_FORMAT = 'YYYY-MM-DD';

const UTC = 'UTC';

const QUOTE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
};
const DAY_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
};
const SHORT_MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'short' };
const NARROW_MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'narrow' };

/** As with the number formatters, building one costs far more than using it, so each set of options builds once. */
const dateFormats = new Map<string, Intl.DateTimeFormat>();

const dateFormatOf = (locale: Locale, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale} ${JSON.stringify(options)}`;
  const cached = dateFormats.get(key);

  if (cached !== undefined) return cached;

  const format = new Intl.DateTimeFormat(locale, options);
  dateFormats.set(key, format);

  return format;
};

/** In the browser's zone, the one a person reads an instant in. */
const formatInstant = (
  locale: Locale,
  instant: dayjs.Dayjs,
  options: Intl.DateTimeFormatOptions
) => dateFormatOf(locale, options).format(instant.toDate());

/**
 * A calendar day or month has no zone: it is written at its UTC midnight and
 * read back in UTC, so no offset can name the day before or after it.
 */
const formatUtcDay = (
  locale: Locale,
  utcStart: dayjs.Dayjs,
  options: Intl.DateTimeFormatOptions
) =>
  dateFormatOf(locale, { ...options, timeZone: UTC }).format(utcStart.toDate());

const calendarDayOrNull = (day: string) => {
  const parsed = dayjs(day, CALENDAR_DAY_FORMAT, true);

  return parsed.isValid() ? parsed : null;
};

const utcCalendarDayOrNull = (day: string) => {
  const parsed = dayjs.utc(day, CALENDAR_DAY_FORMAT, true);

  return parsed.isValid() ? parsed : null;
};

export const formatQuoteTime = (locale: Locale, timestamp: string) =>
  formatInstant(locale, dayjs(timestamp), QUOTE_TIME_FORMAT);

/** A transaction records the day it was executed, picked in the browser's zone. */
export const formatExecutionDay = (locale: Locale, timestamp: string) =>
  formatInstant(locale, dayjs(timestamp), DAY_FORMAT);

/** A series day is a calendar day at midnight UTC, and a local zone would name the day before it. */
export const formatSeriesDay = (locale: Locale, timestamp: string) =>
  formatUtcDay(locale, dayjs.utc(timestamp), DAY_FORMAT);

const formatCalendarDayWith = (
  locale: Locale,
  day: string,
  options: Intl.DateTimeFormatOptions
) => {
  const utcStart = utcCalendarDayOrNull(day);

  return utcStart === null ? null : formatUtcDay(locale, utcStart, options);
};

export const formatCalendarDay = (locale: Locale, day: string) =>
  formatCalendarDayWith(locale, day, DAY_FORMAT);

/** The UTC midnight that starts `day`, for a message that writes the day itself, in its zone, UTC. */
export const utcDateOfCalendarDay = (day: string) =>
  utcCalendarDayOrNull(day)?.toDate() ?? null;

/** The calendar's own months are local midnights, so the month is read in the browser's zone. */
export const formatShortMonth = (locale: Locale, month: Date) =>
  formatInstant(locale, dayjs(month), SHORT_MONTH_FORMAT);

export const currentInstant = () => dayjs().toISOString();

export const calendarDayOf = (instant: string) =>
  dayjs(instant).format(CALENDAR_DAY_FORMAT);

/** The calendar's own value: the local midnight that starts the day. */
export const dateOfCalendarDay = (day: string) =>
  calendarDayOrNull(day)?.toDate();

export const calendarDayOfDate = (date: Date) =>
  dayjs(date).format(CALENDAR_DAY_FORMAT);

/** A month of the calendar: 0 for January to 11 for December. */
export const startOfMonthNumbered = (shown: Date, month: number) =>
  dayjs(shown).startOf('month').month(month).toDate();

export const startOfMonthInYear = (shown: Date, year: number) =>
  dayjs(shown).startOf('month').year(year).toDate();

/**
 * The instant recorded for a day picked in the browser's zone: the later of
 * the day's local and UTC midnights, the first instant on that day in both. The
 * web shows an execution in the browser's zone and the performance series
 * counts it in its UTC day, so both name the day picked, whatever the offset.
 */
export const instantOfCalendarDay = (day: string) => {
  const localStart = calendarDayOrNull(day);
  const utcStart = dayjs.utc(day, CALENDAR_DAY_FORMAT, true);

  if (localStart === null || !utcStart.isValid()) return null;

  return (localStart.isAfter(utcStart) ? localStart : utcStart).toISOString();
};

export const CALENDAR_MONTH_FORMAT = 'YYYY-MM';

const MONTH_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  year: 'numeric'
};
const LONG_MONTH_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'long',
  year: 'numeric'
};
const WEEKDAY_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short'
};
const LONG_WEEKDAY_DAY_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
};

const calendarMonthOrNull = (month: string) => {
  const parsed = dayjs(month, CALENDAR_MONTH_FORMAT, true);

  return parsed.isValid() ? parsed : null;
};

export const isCalendarMonth = (month: string) =>
  calendarMonthOrNull(month) !== null;

export const isCalendarDay = (day: string) => calendarDayOrNull(day) !== null;

/** The first and the last day of `month`, both counted. */
export const daySpanOfCalendarMonth = (month: string) => {
  const start = calendarMonthOrNull(month);

  return start === null
    ? null
    : {
        from: start.format(CALENDAR_DAY_FORMAT),
        to: start.endOf('month').format(CALENDAR_DAY_FORMAT)
      };
};

export const calendarMonthOfDay = (day: string) =>
  calendarDayOrNull(day)?.format(CALENDAR_MONTH_FORMAT) ?? null;

/** `count` months after `month`, or before it when negative. */
export const shiftCalendarMonth = (month: string, count: number) =>
  calendarMonthOrNull(month)
    ?.add(count, 'month')
    .format(CALENDAR_MONTH_FORMAT) ?? null;

/** Months from `from` to `to`, counting both. */
export const monthSpanOf = (from: string, to: string) => {
  const start = calendarMonthOrNull(from);
  const end = calendarMonthOrNull(to);

  return start === null || end === null ? null : end.diff(start, 'month') + 1;
};

const formatCalendarMonthWith = (
  locale: Locale,
  month: string,
  options: Intl.DateTimeFormatOptions
) => {
  const utcStart = dayjs.utc(month, CALENDAR_MONTH_FORMAT, true);

  return utcStart.isValid() ? formatUtcDay(locale, utcStart, options) : null;
};

export const formatCalendarMonth = (locale: Locale, month: string) =>
  formatCalendarMonthWith(locale, month, MONTH_FORMAT);

export const formatLongCalendarMonth = (locale: Locale, month: string) =>
  formatCalendarMonthWith(locale, month, LONG_MONTH_FORMAT);

export const formatShortCalendarMonth = (locale: Locale, month: string) =>
  formatCalendarMonthWith(locale, month, SHORT_MONTH_FORMAT);

export const formatNarrowCalendarMonth = (locale: Locale, month: string) =>
  formatCalendarMonthWith(locale, month, NARROW_MONTH_FORMAT);

export const formatWeekdayCalendarDay = (locale: Locale, day: string) =>
  formatCalendarDayWith(locale, day, WEEKDAY_DAY_FORMAT);

export const formatLongWeekdayCalendarDay = (locale: Locale, day: string) =>
  formatCalendarDayWith(locale, day, LONG_WEEKDAY_DAY_FORMAT);

/** Weekday names from Sunday, in the form `format` asks for, such as "dom." or "domingo". */
export const weekdayNames = (
  locale: Locale,
  format: 'narrow' | 'short' | 'long'
) =>
  Array.from({ length: 7 }, (_, weekday) =>
    // 2023-01-01 was a Sunday.
    formatUtcDay(locale, dayjs.utc('2023-01-01').add(weekday, 'day'), {
      weekday: format
    })
  );

/** `count` months after `day`, on the month's last day when it is shorter, as the API schedules. */
export const shiftCalendarDayByMonths = (day: string, count: number) =>
  calendarDayOrNull(day)?.add(count, 'month').format(CALENDAR_DAY_FORMAT) ??
  null;

export const shiftCalendarDay = (day: string, count: number) =>
  calendarDayOrNull(day)?.add(count, 'day').format(CALENDAR_DAY_FORMAT) ?? null;

/** Whole days from `from` to `to`: negative when `to` comes first. */
export const daysBetween = (from: string, to: string) => {
  const start = calendarDayOrNull(from);
  const end = calendarDayOrNull(to);

  return start === null || end === null ? null : end.diff(start, 'day');
};

/** Every day of `month`, and the weekday of its first, 0 for Sunday to 6 for Saturday. */
export const daysOfCalendarMonth = (month: string) => {
  const start = calendarMonthOrNull(month);

  if (start === null) return null;

  return {
    firstWeekday: start.day(),
    days: Array.from({ length: start.daysInMonth() }, (_, index) =>
      start.add(index, 'day').format(CALENDAR_DAY_FORMAT)
    )
  };
};
