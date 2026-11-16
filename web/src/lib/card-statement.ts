import type { CreditCardCycle, Expense } from '@/app/api/v1/finances';
import { isCalendarDay } from '@/lib/dates';

export type CardStatement = Record<'closingDate' | 'dueDate', string>;

const MONTHS_IN_YEAR = 12;

const CALENDAR_DAY_PATTERN = /^(\d{4})-(\d{2})-\d{2}$/;

const monthIndexOf = (day: string) => {
  const [, year, month] = CALENDAR_DAY_PATTERN.exec(day) ?? [];

  return Number(year) * MONTHS_IN_YEAR + Number(month) - 1;
};

const dayOfMonth = (monthIndex: number, anchorDay: number) => {
  const year = Math.floor(monthIndex / MONTHS_IN_YEAR);
  const month = monthIndex - year * MONTHS_IN_YEAR;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return [
    String(year).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(Math.min(anchorDay, lastDay)).padStart(2, '0')
  ].join('-');
};

/**
 * The backend's `cardStatementOf`, on calendar days, to show the card payment
 * date before saving; the two must agree.
 */
export const cardStatementOf = (
  { closingDay, dueDay }: CreditCardCycle,
  chargeDay: string
): CardStatement | null => {
  if (!isCalendarDay(chargeDay)) return null;

  const closesMonthBefore = closingDay > dueDay;
  const closingDateOf = (dueMonth: number) =>
    dayOfMonth(dueMonth - (closesMonthBefore ? 1 : 0), closingDay);
  const firstDueMonth = monthIndexOf(chargeDay) + (closesMonthBefore ? 1 : 0);
  const dueMonth =
    closingDateOf(firstDueMonth) > chargeDay
      ? firstDueMonth
      : firstDueMonth + 1;

  return {
    closingDate: closingDateOf(dueMonth),
    dueDate: dayOfMonth(dueMonth, dueDay)
  };
};

export const ownDueDateOf = ({
  dueDate,
  originalDueDate
}: Pick<Expense, 'dueDate' | 'originalDueDate'>) => originalDueDate ?? dueDate;
