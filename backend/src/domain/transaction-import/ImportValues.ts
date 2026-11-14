import { Prisma } from '@prisma/client';

import { DecimalColumn } from '@/config/Constants';
import {
  addDays,
  formatCalendarDay,
  parseCalendarDay
} from '@/domain/CalendarDay';
import type { CalendarDay } from '@/domain/models';

import type { SlashedDates } from './ImportRecord';

export type ImportCell = Record<'value', string> &
  Record<'kind', 'number' | 'text'>;

export type DecimalSeparator = ',' | '.';

export type ValueParse<Value> =
  | Record<'outcome', 'missing'>
  | Record<'outcome', 'invalid'>
  | (Record<'outcome', 'parsed'> & Record<'value', Value>);

const MISSING = { outcome: 'missing' } as const;
const INVALID = { outcome: 'invalid' } as const;
const AMBIGUOUS = { outcome: 'ambiguous' } as const;

const parsed = <Value>(value: Value) => ({ outcome: 'parsed', value }) as const;

const INTEGER_DIGITS = DecimalColumn.PRECISION - DecimalColumn.SCALE;

const EMPTY_VALUES = new Set(['', '-', '–', '—']);
const CURRENCY_DECORATION = /R\$|US\$|\$|\s/g;
const UNSIGNED_DIGITS = /^[\d.,]+$/;
const GROUPED_INTEGER = /^[1-9]\d{0,2}(?:[.,]\d{3})+$/;
const GROUPED_INTEGER_BY_SEPARATOR: Record<DecimalSeparator, RegExp> = {
  '.': /^\d{1,3}(?:\.\d{3})+$/,
  ',': /^\d{1,3}(?:,\d{3})+$/
};

const isBlank = (cell: ImportCell | null) =>
  cell === null || EMPTY_VALUES.has(cell.value.trim());

export const normalizeLabel = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const textOf = (cell: ImportCell | null) =>
  isBlank(cell) || cell === null ? null : cell.value.trim();

const canonicalDecimalOf = (digits: string) => {
  const value = new Prisma.Decimal(digits);
  const [integerPart, fractionPart = ''] = value.abs().toFixed().split('.');

  return integerPart.length > INTEGER_DIGITS ||
    fractionPart.length > DecimalColumn.SCALE
    ? null
    : value.toFixed();
};

/**
 * Which of `.` and `,` separates the decimals of a written number. Both in one
 * value: the last one does. One of them more than once: the other one, as the
 * repeated one groups thousands. One of them once, with other than three
 * digits after it or after a lone zero: that one does, since a thousands group
 * always has three and never follows a zero. Otherwise the value is ambiguous
 * on its own, `1.234` and `1,234`, and the convention of the file decides.
 */
const decimalSeparatorOf = <Convention extends DecimalSeparator | null>(
  digits: string,
  convention: Convention
): DecimalSeparator | Convention | null => {
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1)
    return lastDot > lastComma ? '.' : ',';

  const separator = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;

  if (separator === null) return null;

  const occurrences = digits.split(separator).length - 1;
  const digitsAfter = digits.length - digits.lastIndexOf(separator) - 1;

  if (occurrences > 1) return separator === '.' ? ',' : '.';
  if (digitsAfter !== 3) return separator;

  return GROUPED_INTEGER.test(digits) ? convention : separator;
};

export const parseDecimal = (
  cell: ImportCell | null,
  convention: DecimalSeparator
): ValueParse<string> => {
  if (isBlank(cell) || cell === null) return MISSING;

  if (cell.kind === 'number') {
    if (cell.value.startsWith('-')) return INVALID;

    const canonical = canonicalDecimalOf(cell.value);

    return canonical === null ? INVALID : parsed(canonical);
  }

  const digits = cell.value.replace(CURRENCY_DECORATION, '');

  if (!UNSIGNED_DIGITS.test(digits) || !/\d/.test(digits)) return INVALID;

  const separator = decimalSeparatorOf(digits, convention);
  const pointAt = separator === null ? -1 : digits.lastIndexOf(separator);
  const integerPart = pointAt === -1 ? digits : digits.slice(0, pointAt);
  const fractionPart = pointAt === -1 ? '' : digits.slice(pointAt + 1);
  const groupSeparator = separator === ',' ? '.' : ',';
  const isInteger =
    /^\d+$/.test(integerPart) ||
    GROUPED_INTEGER_BY_SEPARATOR[groupSeparator].test(integerPart);

  if (!isInteger || (pointAt !== -1 && !/^\d+$/.test(fractionPart)))
    return INVALID;

  const canonical = canonicalDecimalOf(
    `${integerPart.replaceAll(groupSeparator, '')}${pointAt === -1 ? '' : `.${fractionPart}`}`
  );

  return canonical === null ? INVALID : parsed(canonical);
};

export const writtenDecimalSeparatorOf = (
  cell: ImportCell | null
): DecimalSeparator | null => {
  if (cell === null || cell.kind === 'number' || isBlank(cell)) return null;

  const digits = cell.value.replace(CURRENCY_DECORATION, '');

  if (!UNSIGNED_DIGITS.test(digits) || !/\d/.test(digits)) return null;

  const separator = decimalSeparatorOf(digits, null);

  return separator !== null &&
    parseDecimal(cell, separator).outcome === 'parsed'
    ? separator
    : null;
};

/** Days between the epoch a workbook counts its date serials from and the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25_569;
const EXCEL_1904_EPOCH_OFFSET_DAYS = 24_107;
const DAY_MS = 86_400_000;
const LAST_WORKBOOK_DAY = Date.UTC(9999, 11, 31) / DAY_MS;
const SLASHED_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MONTHS = 12;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

const isoDayOf = (year: string, month: string, day: string) =>
  `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

export const slashedDateOrderOf = (
  cell: ImportCell | null
): Exclude<SlashedDates, 'ambiguous'> | null => {
  const slashed =
    cell === null || cell.kind === 'number'
      ? null
      : SLASHED_DATE.exec(cell.value.trim());

  if (slashed === null) return null;

  const [first, second] = [Number(slashed[1]), Number(slashed[2])];

  if (first > MONTHS && second <= MONTHS) return 'day-first';
  if (second > MONTHS && first <= MONTHS) return 'month-first';

  return null;
};

export const parseTradeDate = (
  cell: ImportCell | null,
  {
    date1904,
    slashedDates
  }: Record<'date1904', boolean> & Record<'slashedDates', SlashedDates>
): ValueParse<CalendarDay> | typeof AMBIGUOUS => {
  if (isBlank(cell) || cell === null) return MISSING;

  if (cell.kind === 'number') {
    const serial = Number(cell.value);

    if (!Number.isFinite(serial) || serial < 1) return INVALID;

    const days =
      Math.floor(serial) -
      (date1904 ? EXCEL_1904_EPOCH_OFFSET_DAYS : EXCEL_EPOCH_OFFSET_DAYS);

    return days > LAST_WORKBOOK_DAY
      ? INVALID
      : parsed(formatCalendarDay(new Date(days * DAY_MS)));
  }

  const text = cell.value.trim();
  const slashed = SLASHED_DATE.exec(text);

  if (slashed !== null && slashedDates === 'ambiguous') return AMBIGUOUS;
  const iso = slashed === null ? ISO_DATE.exec(text) : null;
  const candidate = slashed
    ? isoDayOf(
        slashed[3],
        ...(slashedDates === 'month-first'
          ? ([slashed[1], slashed[2]] as const)
          : ([slashed[2], slashed[1]] as const))
      )
    : iso
      ? isoDayOf(iso[1], iso[2], iso[3])
      : null;

  return candidate !== null && parseCalendarDay(candidate) !== null
    ? parsed(candidate)
    : INVALID;
};

const B3_TIME_ZONE = 'America/Sao_Paulo';

const saoPauloDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: B3_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const saoPauloClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: B3_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
});

export const saoPauloDayOf = (instant: Date): CalendarDay =>
  saoPauloDayFormat.format(instant);

/** The wall clock of São Paulo at the instant, read as if it were UTC. */
const saoPauloWallClockOf = (instant: number) => {
  const parts = Object.fromEntries(
    saoPauloClockFormat
      .formatToParts(instant)
      .map(({ type, value }) => [type, Number(value)])
  );

  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
};

/** B3 settles a trade two business days after it was made: up to a week later across weekends and holidays. */
const SETTLEMENT_WINDOW_DAYS = 7;

export type DayRange = Record<'first' | 'last', CalendarDay>;

const dayAfter = (day: CalendarDay, days: number): CalendarDay =>
  formatCalendarDay(addDays(new Date(`${day}T00:00:00Z`), days));

export const settlementDaysOf = (tradeDay: CalendarDay): DayRange => ({
  first: tradeDay,
  last: dayAfter(tradeDay, SETTLEMENT_WINDOW_DAYS)
});

export const tradeDaysOf = (settlementDay: CalendarDay): DayRange => ({
  first: dayAfter(settlementDay, -SETTLEMENT_WINDOW_DAYS),
  last: settlementDay
});

export const isWithin = (day: CalendarDay, { first, last }: DayRange) =>
  first <= day && day <= last;

const ONE_HOUR_MS = 3_600_000;
const NOON_MS = 12 * ONE_HOUR_MS;

/**
 * The first instant of the trading day in São Paulo, where B3 trades, which
 * is the instant the web records a day typed by someone in Brazil at. Read at
 * the offset São Paulo has at noon of the day, never inside a clock change, so
 * a day daylight saving time started on at midnight starts at 01:00.
 */
export const startOfTradingDay = (day: CalendarDay): Date => {
  const midnight = Date.parse(`${day}T00:00:00Z`);
  const offset = saoPauloWallClockOf(midnight + NOON_MS) - (midnight + NOON_MS);
  const start = midnight - offset;

  return new Date(
    saoPauloDayOf(new Date(start)) === day ? start : start + ONE_HOUR_MS
  );
};
