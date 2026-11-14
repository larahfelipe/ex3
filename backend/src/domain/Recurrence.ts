import {
  addDays,
  addMonths,
  differenceInDays,
  maxDay,
  minDay
} from './CalendarDay';
import type { RecurrenceFrequency, RecurringExpenseStatus } from './models';

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate: Date | null;
};

/**
 * The `index`-th occurrence, counted from the start, which is the first. Every
 * occurrence derives from the start rather than from the previous one: a
 * monthly series started on the 31st falls on the last day of shorter months
 * and returns to the 31st, and a yearly one started on 29 February falls on 28
 * February outside leap years.
 */
export const occurrenceAt = (
  { frequency, startDate }: Pick<RecurrenceRule, 'frequency' | 'startDate'>,
  index: number
) => {
  if (frequency === 'WEEKLY') return addDays(startDate, index * DAYS_PER_WEEK);
  if (frequency === 'MONTHLY') return addMonths(startDate, index);

  return addMonths(startDate, index * MONTHS_PER_YEAR);
};

const firstIndexNear = (
  { frequency, startDate }: Pick<RecurrenceRule, 'frequency' | 'startDate'>,
  day: Date
) => {
  const elapsedDays = differenceInDays(day, startDate);

  if (elapsedDays <= 0) return 0;
  if (frequency === 'WEEKLY') return Math.floor(elapsedDays / DAYS_PER_WEEK);

  const elapsedMonths =
    (day.getUTCFullYear() - startDate.getUTCFullYear()) * MONTHS_PER_YEAR +
    day.getUTCMonth() -
    startDate.getUTCMonth() -
    1;

  if (frequency === 'MONTHLY') return Math.max(0, elapsedMonths);

  return Math.max(0, Math.floor(elapsedMonths / MONTHS_PER_YEAR));
};

export const occurrencesBetween = (
  rule: RecurrenceRule,
  from: Date,
  through: Date
) => {
  const last =
    rule.endDate !== null && rule.endDate.getTime() < through.getTime()
      ? rule.endDate
      : through;
  const occurrences: Array<Date> = [];

  for (let index = firstIndexNear(rule, from); ; index += 1) {
    const occurrence = occurrenceAt(rule, index);

    if (occurrence.getTime() > last.getTime()) return occurrences;
    if (occurrence.getTime() >= from.getTime()) occurrences.push(occurrence);
  }
};

export const nextOccurrence = (rule: RecurrenceRule, day: Date) => {
  for (let index = firstIndexNear(rule, day); ; index += 1) {
    const occurrence = occurrenceAt(rule, index);

    if (rule.endDate !== null && occurrence.getTime() > rule.endDate.getTime())
      return null;
    if (occurrence.getTime() >= day.getTime()) return occurrence;
  }
};

export const nextBillDay = (
  rule: RecurrenceRule & Record<'generatedThrough', Date>,
  today: Date,
  earliestCreated: Date | null
) => {
  const scheduled = nextOccurrence(
    rule,
    maxDay(today, addDays(rule.generatedThrough, 1))
  );

  if (earliestCreated === null || scheduled === null)
    return earliestCreated ?? scheduled;

  return minDay(earliestCreated, scheduled);
};

export const recurringExpenseStatusOf = (
  {
    endDate,
    cancelledAt
  }: Pick<RecurrenceRule, 'endDate'> & { cancelledAt: Date | null },
  today: Date
): RecurringExpenseStatus => {
  if (cancelledAt !== null) return 'CANCELLED';

  return endDate !== null && endDate.getTime() < today.getTime()
    ? 'ENDED'
    : 'ACTIVE';
};
