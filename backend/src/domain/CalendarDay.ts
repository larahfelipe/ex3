import type { CalendarDay, CalendarMonth } from './models';

/**
 * A calendar day is handled as the `Date` Prisma reads and writes a `DATE`
 * column with: the UTC midnight that starts it. Every function here works in
 * UTC, so no server or client time zone moves a day.
 */

const CALENDAR_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CALENDAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_PER_YEAR = 12;

const utcDay = (year: number, monthIndex: number, day: number) => {
  const date = new Date(0);

  date.setUTCFullYear(year, monthIndex, day);

  return date;
};

export const parseCalendarDay = (value: string): Date | null => {
  const match = CALENDAR_DAY_PATTERN.exec(value);

  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = utcDay(year, month - 1, day);

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
};

export const parseCalendarMonth = (value: string): Date | null => {
  const match = CALENDAR_MONTH_PATTERN.exec(value);

  if (!match) return null;

  const [year, month] = match.slice(1).map(Number);

  return month >= 1 && month <= MONTHS_PER_YEAR
    ? utcDay(year, month - 1, 1)
    : null;
};

export const formatCalendarDay = (day: Date): CalendarDay =>
  day.toISOString().slice(0, 10);

export const formatCalendarMonth = (day: Date): CalendarMonth =>
  day.toISOString().slice(0, 7);

export const utcToday = (now: Date = new Date()) =>
  utcDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

export const addDays = (day: Date, days: number) =>
  new Date(day.getTime() + days * DAY_MS);

export const differenceInDays = (later: Date, earlier: Date) =>
  Math.round((later.getTime() - earlier.getTime()) / DAY_MS);

export const daysInMonth = (year: number, monthIndex: number) =>
  utcDay(year, monthIndex + 1, 0).getUTCDate();

export const addMonths = (
  day: Date,
  months: number,
  anchorDay: number = day.getUTCDate()
) => {
  const monthOrdinal =
    day.getUTCFullYear() * MONTHS_PER_YEAR + day.getUTCMonth();
  const targetOrdinal = monthOrdinal + months;
  const year = Math.floor(targetOrdinal / MONTHS_PER_YEAR);
  const monthIndex = targetOrdinal - year * MONTHS_PER_YEAR;

  return utcDay(
    year,
    monthIndex,
    Math.min(anchorDay, daysInMonth(year, monthIndex))
  );
};

export const startOfMonth = (day: Date) =>
  utcDay(day.getUTCFullYear(), day.getUTCMonth(), 1);

export const endOfMonth = (day: Date) =>
  utcDay(day.getUTCFullYear(), day.getUTCMonth() + 1, 0);

export const monthsBetween = (from: Date, to: Date) => {
  const months: Array<Date> = [];

  for (
    let month = startOfMonth(from);
    month.getTime() <= to.getTime();
    month = addMonths(month, 1)
  )
    months.push(month);

  return months;
};

export const isSameDay = (left: Date, right: Date) =>
  left.getTime() === right.getTime();

export const minDay = (left: Date, right: Date) =>
  left.getTime() <= right.getTime() ? left : right;

export const maxDay = (left: Date, right: Date) =>
  left.getTime() >= right.getTime() ? left : right;
