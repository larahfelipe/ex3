import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';

/**
 * The API takes and returns instants as ISO 8601 and stores them in UTC; a day
 * of a performance series is its midnight UTC. Every date the web reads,
 * converts or shows passes through here: an instant in the browser's zone, a
 * series day in UTC.
 */

dayjs.extend(customParseFormat);
dayjs.extend(utc);

/** How the form keeps a calendar day. */
export const CALENDAR_DAY_FORMAT = 'YYYY-MM-DD';

const QUOTE_TIME_FORMAT = 'MMM D, hh:mm A';
const DAY_FORMAT = 'MMM D, YYYY';
const SHORT_MONTH_FORMAT = 'MMM';

const calendarDayOrNull = (day: string) => {
  const parsed = dayjs(day, CALENDAR_DAY_FORMAT, true);

  return parsed.isValid() ? parsed : null;
};

export const formatQuoteTime = (timestamp: string) =>
  dayjs(timestamp).format(QUOTE_TIME_FORMAT);

/** A transaction records the day it was executed, picked in the browser's zone. */
export const formatExecutionDay = (timestamp: string) =>
  dayjs(timestamp).format(DAY_FORMAT);

/** A series day is a calendar day at midnight UTC, and a local zone would name the day before it. */
export const formatSeriesDay = (timestamp: string) =>
  dayjs.utc(timestamp).format(DAY_FORMAT);

export const formatCalendarDay = (day: string) =>
  calendarDayOrNull(day)?.format(DAY_FORMAT) ?? null;

export const formatShortMonth = (month: Date) =>
  dayjs(month).format(SHORT_MONTH_FORMAT);

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
