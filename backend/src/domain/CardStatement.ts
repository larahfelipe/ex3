import { addMonths, startOfMonth } from './CalendarDay';
import type { CreditCardCycle } from './models';

export type CardStatement = Record<'closingDate' | 'dueDate', Date>;

export const cardStatementOf = (
  { closingDay, dueDay }: CreditCardCycle,
  chargeDay: Date
): CardStatement => {
  const closesMonthBefore = closingDay > dueDay;
  const closingDateOf = (dueMonth: Date) =>
    addMonths(dueMonth, closesMonthBefore ? -1 : 0, closingDay);

  const firstDueMonth = addMonths(
    startOfMonth(chargeDay),
    closesMonthBefore ? 1 : 0
  );
  const dueMonth =
    closingDateOf(firstDueMonth).getTime() > chargeDay.getTime()
      ? firstDueMonth
      : addMonths(firstDueMonth, 1);

  return {
    closingDate: closingDateOf(dueMonth),
    dueDate: addMonths(dueMonth, 0, dueDay)
  };
};

export const cardDueDateOf = (cycle: CreditCardCycle, billDueDate: Date) =>
  cardStatementOf(cycle, billDueDate).dueDate;
