import { decimalOf, type DecimalInput, sumOf } from './FinanceMoney';
import type { ExpenseKind, ExpenseStatus } from './models';

export type SettlingPayment = {
  amount: DecimalInput;
  discount: DecimalInput;
  paidOn: Date;
  voidedAt: Date | null;
};

export type Settlement =
  | {
      outcome: 'settled';
      settledAmount: string;
      outstandingAmount: string;
      /** The latest payment day once the payments cover the whole amount, null before. */
      settledOn: Date | null;
    }
  | { outcome: 'over-settled' };

/**
 * Rebuilt from every active payment on each write, never incremented, so a
 * corrected or voided payment leaves no stale balance. A payment set that
 * settles more than the amount is refused: no payment can be recorded twice
 * into an overpayment.
 */
export const settleExpense = (
  amount: DecimalInput,
  payments: ReadonlyArray<SettlingPayment>
): Settlement => {
  const active = payments.filter(({ voidedAt }) => voidedAt === null);
  const due = decimalOf(amount);
  const settled = sumOf(
    active.map((payment) =>
      decimalOf(payment.amount).plus(decimalOf(payment.discount))
    )
  );

  if (settled.greaterThan(due)) return { outcome: 'over-settled' };

  const isSettled = settled.equals(due);

  return {
    outcome: 'settled',
    settledAmount: settled.toFixed(),
    outstandingAmount: due.minus(settled).toFixed(),
    settledOn: isSettled
      ? active.reduce<Date | null>(
          (latest, { paidOn }) =>
            latest === null || paidOn.getTime() > latest.getTime()
              ? paidOn
              : latest,
          null
        )
      : null
  };
};

export type StatusInputs = {
  dueDate: Date;
  settledOn: Date | null;
  cancelledAt: Date | null;
};

/**
 * Overdue is a matter of the day it is asked on, so the status is derived on
 * each read and never stored: due on the reference day is still pending.
 */
export const expenseStatusOf = (
  { dueDate, settledOn, cancelledAt }: StatusInputs,
  today: Date
): ExpenseStatus => {
  if (cancelledAt !== null) return 'CANCELLED';
  if (settledOn !== null) return 'PAID';

  return dueDate.getTime() < today.getTime() ? 'OVERDUE' : 'PENDING';
};

export const expenseKindOf = ({
  installmentPlanId,
  recurringExpenseId
}: Record<
  'installmentPlanId' | 'recurringExpenseId',
  string | null
>): ExpenseKind => {
  if (installmentPlanId !== null) return 'INSTALLMENT';
  if (recurringExpenseId !== null) return 'RECURRING';

  return 'ONE_TIME';
};
