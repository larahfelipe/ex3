import {
  addDays,
  endOfMonth,
  formatCalendarDay,
  formatCalendarMonth,
  startOfMonth
} from './CalendarDay';
import {
  decimalOf,
  type DecimalInput,
  type FinanceDecimal,
  ratioOf,
  sumOf,
  ZERO
} from './FinanceMoney';
import type {
  CalendarDay,
  CalendarMonth,
  ExpenseCategory,
  ExpenseKind
} from './models';

/**
 * Every aggregate is over one currency: the caller filters the rows, because
 * amounts in different currencies never add up. Amounts are exact decimals.
 */

export type AggregateExpense = {
  amount: DecimalInput;
  settledAmount: DecimalInput;
  dueDate: Date;
  settledOn: Date | null;
  cancelledAt: Date | null;
  category: ExpenseCategory;
  kind: ExpenseKind;
};

export type CurrencyExpense = AggregateExpense & { currency: string };

export type AggregatePayment = {
  amount: DecimalInput;
  fees: DecimalInput;
  discount: DecimalInput;
  paidOn: Date;
  category: ExpenseCategory;
  kind: ExpenseKind;
};

export type AmountCount = { amount: string; count: number };

export type UpcomingReminders = Record<
  'remindUpcomingBills' | 'remindUpcomingInstallments',
  boolean
>;

export type MonthlyFigures = {
  month: CalendarMonth;
  /** Σ amount of the expenses due in the month that are owed (not cancelled): what was planned. */
  scheduled: string;
  /** Σ cash paid in the month (payment amount plus fees), by payment day: what actually left. */
  paid: string;
  /** Σ outstanding of the month's expenses not yet settled. */
  outstanding: string;
  /** The part of `outstanding` already past due on the reference day. */
  overdue: string;
};

export type CategoryFigures = {
  category: ExpenseCategory;
  scheduled: string;
  paid: string;
  /** `scheduled` over the period's scheduled total, a fraction. */
  share: string | null;
};

export type KindFigures = {
  kind: ExpenseKind;
  scheduled: string;
  paid: string;
};

export type CommitmentFigures = {
  month: CalendarMonth;
  oneTime: string;
  installments: string;
  recurring: string;
  total: string;
};

export type PeriodTotals = {
  scheduled: AmountCount;
  paid: AmountCount;
  settled: string;
  outstanding: AmountCount;
  overdue: AmountCount;
  fees: string;
  discounts: string;
};

export type Change = { amount: string; percent: string | null };

export type CurrencyAmount = { currency: string; amount: string };

export type CalendarDayFigures = {
  date: CalendarDay;
  /** Expenses owed on the day: neither the cancelled ones nor their amounts count. */
  count: number;
  paidCount: number;
  overdueCount: number;
  totals: Array<CurrencyAmount & { outstanding: string }>;
};

const outstandingOf = ({ amount, settledAmount }: AggregateExpense) =>
  decimalOf(amount).minus(decimalOf(settledAmount));

const cashOf = ({ amount, fees }: AggregatePayment) =>
  decimalOf(amount).plus(decimalOf(fees));

export const isOwed = ({
  cancelledAt
}: Pick<AggregateExpense, 'cancelledAt'>) => cancelledAt === null;

export const isOpen = (
  expense: Pick<AggregateExpense, 'cancelledAt' | 'settledOn'>
) => isOwed(expense) && expense.settledOn === null;

const isWithin = (day: Date, from: Date, to: Date) =>
  day.getTime() >= from.getTime() && day.getTime() <= to.getTime();

const tally = <Row>(
  rows: ReadonlyArray<Row>,
  valueOf: (row: Row) => FinanceDecimal
): AmountCount => ({
  amount: sumOf(rows.map(valueOf)).toFixed(),
  count: rows.length
});

export const overdueOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  today: Date
) =>
  tally(
    expenses.filter(
      (expense) =>
        isOpen(expense) && expense.dueDate.getTime() < today.getTime()
    ),
    outstandingOf
  );

/** Whether a due-soon reminder covers an expense of `kind`: installments have a switch of their own. */
export const remindsUpcoming = (
  kind: ExpenseKind,
  reminders: UpcomingReminders
) =>
  kind === 'INSTALLMENT'
    ? reminders.remindUpcomingInstallments
    : reminders.remindUpcomingBills;

/** Open expenses due from the reference day through `leadDays` days after it, inclusive. */
export const dueSoonOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  today: Date,
  leadDays: number
) =>
  tally(
    expenses.filter(
      (expense) =>
        isOpen(expense) &&
        isWithin(expense.dueDate, today, addDays(today, leadDays))
    ),
    outstandingOf
  );

export const totalsOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  payments: ReadonlyArray<AggregatePayment>,
  { from, to, today }: Record<'from' | 'to' | 'today', Date>
): PeriodTotals => {
  const due = expenses.filter(
    (expense) => isOwed(expense) && isWithin(expense.dueDate, from, to)
  );
  const paid = payments.filter(({ paidOn }) => isWithin(paidOn, from, to));
  const open = due.filter(isOpen);

  return {
    scheduled: tally(due, ({ amount }) => decimalOf(amount)),
    paid: tally(paid, cashOf),
    settled: sumOf(due.map(({ settledAmount }) => settledAmount)).toFixed(),
    outstanding: tally(open, outstandingOf),
    overdue: tally(
      open.filter(({ dueDate }) => dueDate.getTime() < today.getTime()),
      outstandingOf
    ),
    fees: sumOf(paid.map(({ fees }) => fees)).toFixed(),
    discounts: sumOf(paid.map(({ discount }) => discount)).toFixed()
  };
};

export const monthlyFiguresOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  payments: ReadonlyArray<AggregatePayment>,
  months: ReadonlyArray<Date>,
  today: Date
): Array<MonthlyFigures> =>
  months.map((month) => {
    const totals = totalsOf(expenses, payments, {
      from: startOfMonth(month),
      to: endOfMonth(month),
      today
    });

    return {
      month: formatCalendarMonth(month),
      scheduled: totals.scheduled.amount,
      paid: totals.paid.amount,
      outstanding: totals.outstanding.amount,
      overdue: totals.overdue.amount
    };
  });

/** Largest scheduled amount first; a category with only payments in the period is listed too. */
export const categoryFiguresOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  payments: ReadonlyArray<AggregatePayment>,
  { from, to }: Record<'from' | 'to', Date>
): Array<CategoryFigures> => {
  const scheduled = new Map<ExpenseCategory, FinanceDecimal>();
  const paid = new Map<ExpenseCategory, FinanceDecimal>();

  for (const expense of expenses)
    if (isOwed(expense) && isWithin(expense.dueDate, from, to))
      scheduled.set(
        expense.category,
        (scheduled.get(expense.category) ?? ZERO).plus(
          decimalOf(expense.amount)
        )
      );

  for (const payment of payments)
    if (isWithin(payment.paidOn, from, to))
      paid.set(
        payment.category,
        (paid.get(payment.category) ?? ZERO).plus(cashOf(payment))
      );

  const total = sumOf(scheduled.values());
  const categories = new Set([...scheduled.keys(), ...paid.keys()]);

  return [...categories]
    .map((category) => {
      const categoryScheduled = scheduled.get(category) ?? ZERO;

      return {
        category,
        scheduled: categoryScheduled.toFixed(),
        paid: (paid.get(category) ?? ZERO).toFixed(),
        share: ratioOf(categoryScheduled, total),
        order: categoryScheduled
      };
    })
    .toSorted(
      (left, right) =>
        right.order.comparedTo(left.order) ||
        left.category.localeCompare(right.category)
    )
    .map(({ order: _, ...figures }) => figures);
};

export const kindFiguresOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  payments: ReadonlyArray<AggregatePayment>,
  { from, to }: Record<'from' | 'to', Date>
): Array<KindFigures> =>
  (['ONE_TIME', 'INSTALLMENT', 'RECURRING'] as const).map((kind) => ({
    kind,
    scheduled: sumOf(
      expenses
        .filter(
          (expense) =>
            expense.kind === kind &&
            isOwed(expense) &&
            isWithin(expense.dueDate, from, to)
        )
        .map(({ amount }) => amount)
    ).toFixed(),
    paid: sumOf(
      payments
        .filter(
          (payment) =>
            payment.kind === kind && isWithin(payment.paidOn, from, to)
        )
        .map(cashOf)
    ).toFixed()
  }));

/**
 * What is still to pay in each month, by origin. Overdue amounts from earlier
 * months are not carried forward: they are reported as overdue, not as a
 * future commitment.
 */
export const commitmentsOf = (
  expenses: ReadonlyArray<AggregateExpense>,
  months: ReadonlyArray<Date>
): Array<CommitmentFigures> =>
  months.map((month) => {
    const open = expenses.filter(
      (expense) =>
        isOpen(expense) &&
        isWithin(expense.dueDate, startOfMonth(month), endOfMonth(month))
    );
    const ofKind = (kind: ExpenseKind) =>
      sumOf(open.filter((expense) => expense.kind === kind).map(outstandingOf));

    return {
      month: formatCalendarMonth(month),
      oneTime: ofKind('ONE_TIME').toFixed(),
      installments: ofKind('INSTALLMENT').toFixed(),
      recurring: ofKind('RECURRING').toFixed(),
      total: sumOf(open.map(outstandingOf)).toFixed()
    };
  });

/** `percent` is a fraction of the previous value, absent when it is zero. */
export const changeOf = (current: string, previous: string): Change => {
  const amount = decimalOf(current).minus(decimalOf(previous));

  return { amount: amount.toFixed(), percent: ratioOf(amount, previous) };
};

/** Σ outstanding by currency, alphabetically: amounts in different currencies are listed side by side, never added. */
export const outstandingByCurrencyOf = (
  expenses: ReadonlyArray<{ currency: string; outstandingAmount: DecimalInput }>
): Array<CurrencyAmount> => {
  const totals = new Map<string, FinanceDecimal>();

  for (const { currency, outstandingAmount } of expenses)
    totals.set(
      currency,
      (totals.get(currency) ?? ZERO).plus(decimalOf(outstandingAmount))
    );

  return [...totals]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => ({ currency, amount: amount.toFixed() }));
};

/** The days of a month with an owed expense, in order, each with its totals by currency. */
export const calendarDaysOf = (
  expenses: ReadonlyArray<CurrencyExpense>,
  today: Date
): Array<CalendarDayFigures> => {
  const days = new Map<string, Array<CurrencyExpense>>();

  for (const expense of expenses.filter(isOwed)) {
    const date = formatCalendarDay(expense.dueDate);

    days.set(date, [...(days.get(date) ?? []), expense]);
  }

  return [...days]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([date, owed]) => {
      const currencies = [...new Set(owed.map(({ currency }) => currency))];

      return {
        date,
        count: owed.length,
        paidCount: owed.filter(({ settledOn }) => settledOn !== null).length,
        overdueCount: owed.filter(
          (expense) =>
            isOpen(expense) && expense.dueDate.getTime() < today.getTime()
        ).length,
        totals: currencies.toSorted().map((currency) => {
          const ofCurrency = owed.filter(
            (expense) => expense.currency === currency
          );

          return {
            currency,
            amount: sumOf(ofCurrency.map(({ amount }) => amount)).toFixed(),
            outstanding: sumOf(
              ofCurrency.filter(isOpen).map(outstandingOf)
            ).toFixed()
          };
        })
      };
    });
};
