import { formatCalendarDay } from './CalendarDay';
import {
  decimalOf,
  splitIntoInstallments,
  sumOf,
  type DecimalInput
} from './FinanceMoney';
import type { InstallmentPlanStatus, RecurrenceFrequency } from './models';
import { occurrenceAt } from './Recurrence';

export type ScheduledInstallment = {
  installmentNumber: number;
  dueDate: Date;
  amount: string;
};

export type InstallmentTerms = {
  amount: { totalAmount: string } | { installmentAmount: string };
  count: number;
  firstDueDate: Date;
  frequency: RecurrenceFrequency;
  currency: string;
  firstNumber: number;
};

export const scheduleInstallments = ({
  amount,
  count,
  firstDueDate,
  frequency,
  currency,
  firstNumber
}: InstallmentTerms): Array<ScheduledInstallment> | null => {
  const amounts =
    'totalAmount' in amount
      ? splitIntoInstallments(amount.totalAmount, count, currency)
      : Array.from({ length: count }, () =>
          decimalOf(amount.installmentAmount).toFixed()
        );

  if (amounts === null) return null;

  return amounts.map((installmentAmount, index) => ({
    installmentNumber: firstNumber + index,
    dueDate: occurrenceAt({ frequency, startDate: firstDueDate }, index),
    amount: installmentAmount
  }));
};

export type PlanInstallment = {
  installmentNumber: number;
  amount: DecimalInput;
  settledAmount: DecimalInput;
  dueDate: Date;
  settledOn: Date | null;
  cancelledAt: Date | null;
};

export type InstallmentPlanProgress = {
  status: InstallmentPlanStatus;
  installmentCount: number;
  totalAmount: string;
  settledAmount: string;
  outstandingAmount: string;
  financingCost: string | null;
  paidInstallments: number;
  remainingInstallments: number;
  nextDueDate: string | null;
  nextInstallmentNumber: number | null;
  firstDueDate: string | null;
  lastDueDate: string | null;
};

export const describeInstallmentPlan = (
  installments: ReadonlyArray<PlanInstallment>,
  {
    principalAmount,
    cancelledAt
  }: { principalAmount: DecimalInput | null; cancelledAt: Date | null }
): InstallmentPlanProgress => {
  const owed = installments
    .filter((installment) => installment.cancelledAt === null)
    .toSorted(
      (left, right) => left.installmentNumber - right.installmentNumber
    );
  const open = owed.filter(({ settledOn }) => settledOn === null);
  const total = sumOf(owed.map(({ amount }) => amount));
  const settled = sumOf(owed.map(({ settledAmount }) => settledAmount));
  const next = open.at(0);

  const status: InstallmentPlanStatus =
    cancelledAt !== null
      ? 'CANCELLED'
      : open.length === 0 && owed.length > 0
        ? 'COMPLETED'
        : 'ACTIVE';

  return {
    status,
    installmentCount: owed.length,
    totalAmount: total.toFixed(),
    settledAmount: settled.toFixed(),
    outstandingAmount: total.minus(settled).toFixed(),
    financingCost:
      principalAmount === null
        ? null
        : total.minus(decimalOf(principalAmount)).toFixed(),
    paidInstallments: owed.length - open.length,
    remainingInstallments: open.length,
    nextDueDate: next === undefined ? null : formatCalendarDay(next.dueDate),
    nextInstallmentNumber: next?.installmentNumber ?? null,
    firstDueDate: owed.length === 0 ? null : formatCalendarDay(owed[0].dueDate),
    lastDueDate:
      owed.length === 0
        ? null
        : formatCalendarDay(owed[owed.length - 1].dueDate)
  };
};

export const reschedulableInstallments = <
  Installment extends { installmentNumber: number; hasPayments: boolean }
>(
  installments: ReadonlyArray<Installment>
) => {
  const lastWithPayments = installments.reduce(
    (last, { installmentNumber, hasPayments }) =>
      hasPayments ? Math.max(last, installmentNumber) : last,
    0
  );

  return installments.filter(
    ({ installmentNumber }) => installmentNumber > lastWithPayments
  );
};
