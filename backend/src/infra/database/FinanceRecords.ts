import {
  Prisma,
  type Expense as ExpenseRow,
  type ExpensePayment as ExpensePaymentRow,
  type FinanceEvent as FinanceEventRow
} from '@prisma/client';

import { formatCalendarDay } from '@/domain/CalendarDay';
import {
  expenseKindOf,
  expenseStatusOf,
  type SettlingPayment
} from '@/domain/ExpenseSettlement';
import { fitsMinorUnits } from '@/domain/FinanceMoney';
import type {
  Expense,
  ExpenseDescription,
  ExpenseKind,
  ExpensePayment,
  ExpenseStatusFilter,
  FinanceEvent,
  FinanceEventType,
  FinanceRecordType
} from '@/domain/models';

const calendarDayOrNull = (day: Date | null) =>
  day === null ? null : formatCalendarDay(day);

export const toExpense = (
  row: ExpenseRow,
  today: Date,
  installmentCount: number | null = null
): Expense => ({
  id: row.id,
  description: row.description,
  category: row.category,
  subcategory: row.subcategory,
  amount: row.amount.toFixed(),
  currency: row.currency,
  entryDate: formatCalendarDay(row.entryDate),
  dueDate: formatCalendarDay(row.dueDate),
  paymentMethod: row.paymentMethod,
  account: row.account,
  notes: row.notes,
  settledAmount: row.settledAmount.toFixed(),
  outstandingAmount: row.amount.minus(row.settledAmount).toFixed(),
  settledOn: calendarDayOrNull(row.settledOn),
  cancelledAt: row.cancelledAt,
  kind: expenseKindOf(row),
  status: expenseStatusOf(row, today),
  installmentPlanId: row.installmentPlanId,
  installmentNumber: row.installmentNumber,
  installmentCount,
  recurringExpenseId: row.recurringExpenseId,
  occurrenceDate: calendarDayOrNull(row.occurrenceDate),
  isCustomized: row.isCustomized,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const DESCRIPTION_FIELDS = [
  'description',
  'category',
  'subcategory',
  'paymentMethod',
  'account',
  'notes'
] as const satisfies ReadonlyArray<keyof ExpenseDescription>;

/** The fields a plan or series hands down to the expenses it creates. */
export const expenseDescriptionOf = (
  row: ExpenseDescription
): ExpenseDescription =>
  Object.fromEntries(
    DESCRIPTION_FIELDS.map((field) => [field, row[field]])
  ) as ExpenseDescription;

export const toPayment = (row: ExpensePaymentRow): ExpensePayment => ({
  id: row.id,
  expenseId: row.expenseId,
  amount: row.amount.toFixed(),
  discount: row.discount.toFixed(),
  fees: row.fees.toFixed(),
  paidOn: formatCalendarDay(row.paidOn),
  method: row.method,
  notes: row.notes,
  voidedAt: row.voidedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const toFinanceEvent = (row: FinanceEventRow): FinanceEvent => ({
  id: row.id,
  recordType: row.recordType,
  recordId: row.recordId,
  type: row.type,
  changes: (row.changes ?? {}) as Record<string, unknown>,
  createdAt: row.createdAt
});

export const OPEN_EXPENSE_WHERE = {
  cancelledAt: null,
  settledOn: null
} as const satisfies Prisma.ExpenseWhereInput;

/** Days as `YYYY-MM-DD` and decimals as their exact string, the way the API writes them. */
const recordedValueOf = (value: unknown): Prisma.InputJsonValue | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return formatCalendarDay(value);
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed();

  return value as Prisma.InputJsonValue;
};

export const recordedValuesOf = (values: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [field, recordedValueOf(value)])
  );

/**
 * `{ field: { from, to } }` for each field of `patch` whose recorded value
 * differs from `current`'s. A decimal string in the patch is compared by value
 * with a decimal column, so `10.50` over `10.5` is no change.
 */
export const changesOf = (
  current: Record<string, unknown>,
  patch: Record<string, unknown>
) =>
  Object.fromEntries(
    Object.entries(patch).flatMap(([field, value]) => {
      if (value === undefined) return [];

      const from = recordedValueOf(current[field]);
      const to = recordedValueOf(
        Prisma.Decimal.isDecimal(current[field]) && typeof value === 'string'
          ? new Prisma.Decimal(value)
          : value
      );

      return JSON.stringify(from) === JSON.stringify(to)
        ? []
        : [[field, { from, to }]];
    })
  ) as Record<string, { from: unknown; to: unknown }>;

export const recordFinanceEvent = (
  transactionClient: Prisma.TransactionClient,
  event: {
    userId: string;
    recordType: FinanceRecordType;
    recordId: string;
    type: FinanceEventType;
    changes: Record<string, unknown>;
  }
) =>
  transactionClient.financeEvent.create({
    data: {
      ...event,
      changes: recordedValuesOf(event.changes) as Prisma.InputJsonObject
    }
  });

export const historyOf = async (
  client: Prisma.TransactionClient,
  params: { userId: string; recordType: FinanceRecordType; recordId: string }
) => {
  const rows = await client.financeEvent.findMany({
    where: params,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  return rows.map(toFinanceEvent);
};

export const deleteHistoryOf = (
  transactionClient: Prisma.TransactionClient,
  params: {
    userId: string;
    recordType: FinanceRecordType;
    recordIds: Array<string>;
  }
) =>
  transactionClient.financeEvent.deleteMany({
    where: {
      userId: params.userId,
      recordType: params.recordType,
      recordId: { in: params.recordIds }
    }
  });

export const toSettlingPayment = (
  row: Pick<ExpensePaymentRow, 'amount' | 'discount' | 'paidOn' | 'voidedAt'>
): SettlingPayment => row;

/** The first of `amounts` with more decimal places than the currency's minor unit, or null. */
export const impreciseFieldOf = (
  amounts: Record<string, string | undefined | null>,
  currency: string
) =>
  Object.entries(amounts).find(
    ([, amount]) =>
      amount !== undefined &&
      amount !== null &&
      !fitsMinorUnits(amount, currency)
  )?.[0] ?? null;

export const kindWhere = (
  kind: ExpenseKind | undefined
): Prisma.ExpenseWhereInput => {
  if (kind === 'ONE_TIME')
    return { installmentPlanId: null, recurringExpenseId: null };
  if (kind === 'INSTALLMENT') return { installmentPlanId: { not: null } };
  if (kind === 'RECURRING') return { recurringExpenseId: { not: null } };

  return {};
};

/** The status of `expenseStatusOf`, as a filter the database applies before paginating. */
export const statusWhere = (
  status: ExpenseStatusFilter | undefined,
  today: Date
): Prisma.ExpenseWhereInput => {
  if (status === 'OPEN') return OPEN_EXPENSE_WHERE;
  if (status === 'CANCELLED') return { cancelledAt: { not: null } };
  if (status === 'PAID') return { cancelledAt: null, settledOn: { not: null } };
  if (status === 'OVERDUE')
    return { cancelledAt: null, settledOn: null, dueDate: { lt: today } };
  if (status === 'PENDING')
    return { cancelledAt: null, settledOn: null, dueDate: { gte: today } };

  return {};
};

/** The highest installment number of each plan, which is its count: numbers run without gaps. */
export const installmentCountsOf = async (
  client: Prisma.TransactionClient,
  planIds: Array<string>
) => {
  if (planIds.length === 0) return new Map<string, number>();

  const groups = await client.expense.groupBy({
    by: ['installmentPlanId'],
    where: { installmentPlanId: { in: planIds } },
    _max: { installmentNumber: true }
  });

  return new Map(
    groups.flatMap(({ installmentPlanId, _max }) =>
      installmentPlanId === null || _max.installmentNumber === null
        ? []
        : [[installmentPlanId, _max.installmentNumber] as const]
    )
  );
};
