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

/** How the form keeps a calendar day and a time of day in the browser's zone. */
export const CALENDAR_DAY_FORMAT = 'YYYY-MM-DD';
export const TIME_OF_DAY_FORMAT = 'HH:mm:ss';

/** A time field leaves the seconds out when they are zero. */
const TIME_OF_DAY_WITHOUT_SECONDS_FORMAT = 'HH:mm';

const LOCAL_MOMENT_FORMATS = [
  TIME_OF_DAY_FORMAT,
  TIME_OF_DAY_WITHOUT_SECONDS_FORMAT
].map((timeFormat) => `${CALENDAR_DAY_FORMAT} ${timeFormat}`);

const QUOTE_TIME_FORMAT = 'MMM D, hh:mm A';
const EXECUTION_TIME_FORMAT = 'MMM D, YYYY, h:mm A';
const DAY_FORMAT = 'MMM D, YYYY';

const calendarDayOrNull = (day: string) => {
  const parsed = dayjs(day, CALENDAR_DAY_FORMAT, true);

  return parsed.isValid() ? parsed : null;
};

export const formatQuoteTime = (timestamp: string) =>
  dayjs(timestamp).format(QUOTE_TIME_FORMAT);

export const formatExecutionTime = (timestamp: string) =>
  dayjs(timestamp).format(EXECUTION_TIME_FORMAT);

/** A series day is a calendar day at midnight UTC, and a local zone would name the day before it. */
export const formatSeriesDay = (timestamp: string) =>
  dayjs.utc(timestamp).format(DAY_FORMAT);

export const formatCalendarDay = (day: string) =>
  calendarDayOrNull(day)?.format(DAY_FORMAT) ?? null;

export const currentInstant = () => dayjs().toISOString();

export const currentYear = () => dayjs().year();

export const calendarDayOf = (instant: string) =>
  dayjs(instant).format(CALENDAR_DAY_FORMAT);

export const timeOfDayOf = (instant: string) =>
  dayjs(instant).format(TIME_OF_DAY_FORMAT);

/** The calendar's own value: the local midnight that starts the day. */
export const dateOfCalendarDay = (day: string) =>
  calendarDayOrNull(day)?.toDate();

export const calendarDayOfDate = (date: Date) =>
  dayjs(date).format(CALENDAR_DAY_FORMAT);

/**
 * The instant a day and a time name in the browser's zone, or null when that
 * zone never shows them, as in the hour skipped when clocks go forward. An
 * hour repeated when clocks go back names its first occurrence.
 */
export const instantOf = (day: string, timeOfDay: string) => {
  const moment = dayjs(`${day} ${timeOfDay}`, LOCAL_MOMENT_FORMATS, true);

  return moment.isValid() ? moment.toISOString() : null;
};
