import type {
  Prisma,
  RecurringExpense as RecurringExpenseRow
} from '@prisma/client';

import {
  addDays,
  formatCalendarDay,
  maxDay,
  minDay
} from '@/domain/CalendarDay';
import { monthlyEquivalentOf } from '@/domain/FinanceMoney';
import type {
  ExpenseDescription,
  FinanceEvent,
  RecurrenceFrequency,
  RecurringExpense,
  RecurringExpenseStatus
} from '@/domain/models';
import {
  nextOccurrence,
  occurrencesBetween,
  recurringExpenseStatusOf
} from '@/domain/Recurrence';
import type { Page } from '@/interfaces';

import {
  changesOf,
  deleteHistoryOf,
  expenseDescriptionOf,
  historyOf,
  impreciseFieldOf,
  OPEN_EXPENSE_WHERE,
  recordFinanceEvent
} from './FinanceRecords';
import { PrismaClient } from './PrismaClient';

export type RecurringExpenseListQuery = {
  userId: string;
  today: Date;
  page: number;
  pageSize: number;
  currency?: string;
  status?: RecurringExpenseStatus;
};

export type RecurringExpenseDetail = RecurringExpense & {
  history: Array<FinanceEvent>;
};

const statusWhere = (
  status: RecurringExpenseStatus | undefined,
  today: Date
): Prisma.RecurringExpenseWhereInput => {
  if (status === 'CANCELLED') return { cancelledAt: { not: null } };
  if (status === 'ENDED') return { cancelledAt: null, endDate: { lt: today } };
  if (status === 'ACTIVE')
    return {
      cancelledAt: null,
      OR: [{ endDate: null }, { endDate: { gte: today } }]
    };

  return {};
};

const toRecurringExpense = (
  row: RecurringExpenseRow,
  today: Date
): RecurringExpense => {
  const status = recurringExpenseStatusOf(row, today);
  const next = status === 'ACTIVE' ? nextOccurrence(row, today) : null;

  return {
    id: row.id,
    ...expenseDescriptionOf(row),
    amount: row.amount.toFixed(),
    isVariable: row.isVariable,
    currency: row.currency,
    frequency: row.frequency,
    startDate: formatCalendarDay(row.startDate),
    endDate: row.endDate === null ? null : formatCalendarDay(row.endDate),
    cancelledAt: row.cancelledAt,
    status,
    monthlyEquivalent: monthlyEquivalentOf(
      row.amount,
      row.frequency,
      row.currency
    ),
    nextDueDate: next === null ? null : formatCalendarDay(next),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

/**
 * Creates the series' occurrences after its `generatedThrough` day through
 * `through`, or through its end date when earlier, and moves the mark there.
 * An occurrence is unique by series and day, so a day generated twice is
 * skipped, never duplicated. Returns the day generation now covers.
 */
const generateOccurrences = async (
  transactionClient: Prisma.TransactionClient,
  row: RecurringExpenseRow,
  through: Date
) => {
  const last = row.endDate === null ? through : minDay(row.endDate, through);

  if (last.getTime() <= row.generatedThrough.getTime())
    return row.generatedThrough;

  const days = occurrencesBetween(row, addDays(row.generatedThrough, 1), last);

  if (days.length > 0)
    await transactionClient.expense.createMany({
      data: days.map((day) => ({
        ...expenseDescriptionOf(row),
        amount: row.amount,
        currency: row.currency,
        entryDate: day,
        dueDate: day,
        occurrenceDate: day,
        recurringExpenseId: row.id,
        userId: row.userId
      })),
      skipDuplicates: true
    });

  await transactionClient.recurringExpense.update({
    where: { id: row.id },
    data: { generatedThrough: last }
  });

  return last;
};

/**
 * An edit or a stop from `effectiveFrom` first creates, on the current terms,
 * every occurrence before that day that is not there yet. A day after
 * `through` would leave occurrences between the two to be generated later on
 * the new terms, so it is refused, unless the series has not started by then.
 */
const latestEffectiveFromOf = (row: RecurringExpenseRow, through: Date) =>
  maxDay(addDays(through, 1), row.startDate);

/**
 * A series materializes its occurrences as expenses ahead of time, up to a
 * horizon the caller gives, so that they are paid, edited and reported like
 * any other expense. `generatedThrough` marks the last day covered.
 */
export class RecurringExpenseRepository {
  private static INSTANCE: RecurringExpenseRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!RecurringExpenseRepository.INSTANCE)
      RecurringExpenseRepository.INSTANCE = new RecurringExpenseRepository();

    return RecurringExpenseRepository.INSTANCE;
  }

  private pendingWhere(
    userId: string,
    through: Date
  ): Prisma.RecurringExpenseWhereInput {
    return {
      userId,
      cancelledAt: null,
      generatedThrough: { lt: through },
      OR: [
        { endDate: null },
        {
          endDate: {
            gt: this.prismaClient.recurringExpense.fields.generatedThrough
          }
        }
      ]
    };
  }

  /**
   * Brings every active series of the user up to `through`. Most calls find
   * nothing to do and return after one read; a concurrent call that also
   * generates conflicts on the series rows and is rerun, finding them done.
   */
  async generateDue(
    params: Record<'userId', string> & Record<'through', Date>
  ) {
    const { userId, through } = params;

    const pending = await this.prismaClient.recurringExpense.count({
      where: this.pendingWhere(userId, through)
    });

    if (pending === 0) return;

    await this.prismaClient.runSerializable(async (transactionClient) => {
      const series = await transactionClient.recurringExpense.findMany({
        where: this.pendingWhere(userId, through)
      });

      for (const row of series)
        await generateOccurrences(transactionClient, row, through);
    });
  }

  async getAll(
    params: RecurringExpenseListQuery
  ): Promise<Page<RecurringExpense>> {
    const { userId, today, page, pageSize, currency, status } = params;

    const where: Prisma.RecurringExpenseWhereInput = {
      AND: [{ userId, currency }, statusWhere(status, today)]
    };

    const [total, rows] = await Promise.all([
      this.prismaClient.recurringExpense.count({ where }),
      this.prismaClient.recurringExpense.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map((row) => toRecurringExpense(row, today)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /** Every series of the currency still running on `today`, for the dashboard's recurring summary. */
  async getActive(
    params: Record<'userId' | 'currency', string> & Record<'today', Date>
  ): Promise<Array<RecurringExpense>> {
    const { userId, currency, today } = params;

    const rows = await this.prismaClient.recurringExpense.findMany({
      where: { userId, currency, ...statusWhere('ACTIVE', today) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return rows.map((row) => toRecurringExpense(row, today));
  }

  async getById(
    params: RecurringExpenseRepository.GetByIdParams & Record<'today', Date>
  ): Promise<RecurringExpenseDetail | null> {
    const { id, userId, today } = params;

    const row = await this.prismaClient.recurringExpense.findFirst({
      where: { id, userId }
    });

    if (!row) return null;

    const history = await historyOf(this.prismaClient, {
      userId,
      recordType: 'RECURRING_EXPENSE',
      recordId: id
    });

    return { ...toRecurringExpense(row, today), history };
  }

  /** The occurrences owe their whole amount: creating a series records no payment. */
  async add(params: RecurringExpenseRepository.AddParams) {
    const { userId, through, ...series } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      const row = await transactionClient.recurringExpense.create({
        data: {
          ...series,
          userId,
          generatedThrough: addDays(series.startDate, -1)
        }
      });

      await generateOccurrences(transactionClient, row, through);

      await recordFinanceEvent(transactionClient, {
        userId,
        recordType: 'RECURRING_EXPENSE',
        recordId: row.id,
        type: 'CREATED',
        changes: series
      });

      return row.id;
    });
  }

  /**
   * The new values reach the occurrences from `effectiveFrom` on that are
   * still owed, have no active payment and were not edited on their own;
   * earlier ones keep what they were. An earlier end date removes the
   * occurrences after it, refused when one of them has a payment record.
   */
  async update(
    params: RecurringExpenseRepository.UpdateParams
  ): Promise<RecurringExpenseRepository.Write> {
    const {
      id,
      userId,
      effectiveFrom,
      through,
      endDate,
      isVariable,
      ...patch
    } = params;

    return this.prismaClient.runSerializable<RecurringExpenseRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.recurringExpense.findFirst({
          where: { id, userId }
        });

        if (!current) return { outcome: 'not-found' };
        if (current.cancelledAt !== null) return { outcome: 'cancelled' };

        const impreciseField = impreciseFieldOf(
          { amount: patch.amount },
          current.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        if (
          endDate !== undefined &&
          endDate !== null &&
          endDate.getTime() < current.startDate.getTime()
        )
          return { outcome: 'end-before-start' };

        const latestEffectiveFrom = latestEffectiveFromOf(current, through);

        if (effectiveFrom.getTime() > latestEffectiveFrom.getTime())
          return {
            outcome: 'effective-after-horizon',
            latestEffectiveFrom: formatCalendarDay(latestEffectiveFrom)
          };

        const changes = changesOf(current, { ...patch, isVariable, endDate });

        if (Object.keys(changes).length === 0) return { outcome: 'written' };

        if (endDate !== undefined && endDate !== null) {
          const beyond = await transactionClient.expense.findMany({
            where: { recurringExpenseId: id, occurrenceDate: { gt: endDate } },
            select: { id: true, _count: { select: { payments: true } } }
          });

          if (beyond.some((occurrence) => occurrence._count.payments > 0))
            return { outcome: 'end-before-paid-occurrence' };

          const beyondIds = beyond.map((occurrence) => occurrence.id);

          await deleteHistoryOf(transactionClient, {
            userId,
            recordType: 'EXPENSE',
            recordIds: beyondIds
          });
          await transactionClient.expense.deleteMany({
            where: { id: { in: beyondIds } }
          });
        }

        const generatedThrough = await generateOccurrences(
          transactionClient,
          {
            ...current,
            endDate: endDate === undefined ? current.endDate : endDate
          },
          minDay(through, addDays(effectiveFrom, -1))
        );

        const updated = await transactionClient.recurringExpense.update({
          where: { id },
          data: {
            ...patch,
            isVariable,
            endDate,
            ...(endDate !== undefined &&
              endDate !== null && {
                generatedThrough: minDay(generatedThrough, endDate)
              })
          }
        });

        if (Object.values(patch).some((value) => value !== undefined))
          await transactionClient.expense.updateMany({
            where: {
              recurringExpenseId: id,
              occurrenceDate: { gte: effectiveFrom },
              isCustomized: false,
              ...OPEN_EXPENSE_WHERE,
              payments: { none: { voidedAt: null } }
            },
            data: patch
          });

        await generateOccurrences(transactionClient, updated, through);

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'RECURRING_EXPENSE',
          recordId: id,
          type: 'UPDATED',
          changes: { ...changes, effectiveFrom }
        });

        return { outcome: 'written' };
      }
    );
  }

  /**
   * Stops the series. From `effectiveFrom` on, an occurrence still owed
   * without an active payment is removed, or cancelled when it has voided
   * payments to keep; earlier occurrences, created first when missing, and
   * partly paid ones stay owed.
   */
  async cancel(
    params: RecurringExpenseRepository.CancelParams
  ): Promise<RecurringExpenseRepository.Write> {
    const { id, userId, effectiveFrom, through } = params;

    return this.prismaClient.runSerializable<RecurringExpenseRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.recurringExpense.findFirst({
          where: { id, userId }
        });

        if (!current) return { outcome: 'not-found' };
        if (current.cancelledAt !== null) return { outcome: 'cancelled' };

        const latestEffectiveFrom = latestEffectiveFromOf(current, through);

        if (effectiveFrom.getTime() > latestEffectiveFrom.getTime())
          return {
            outcome: 'effective-after-horizon',
            latestEffectiveFrom: formatCalendarDay(latestEffectiveFrom)
          };

        await generateOccurrences(
          transactionClient,
          current,
          minDay(through, addDays(effectiveFrom, -1))
        );

        const cancelledAt = new Date();
        const pending = await transactionClient.expense.findMany({
          where: {
            recurringExpenseId: id,
            occurrenceDate: { gte: effectiveFrom },
            ...OPEN_EXPENSE_WHERE,
            payments: { none: { voidedAt: null } }
          },
          select: {
            id: true,
            occurrenceDate: true,
            _count: { select: { payments: true } }
          },
          orderBy: { occurrenceDate: 'asc' }
        });
        const removed = pending.filter(({ _count }) => _count.payments === 0);
        const cancelled = pending.filter(({ _count }) => _count.payments > 0);
        const daysOf = (occurrences: typeof pending) =>
          occurrences.flatMap(({ occurrenceDate }) =>
            occurrenceDate === null ? [] : [formatCalendarDay(occurrenceDate)]
          );

        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordIds: removed.map((occurrence) => occurrence.id)
        });
        await transactionClient.expense.deleteMany({
          where: { id: { in: removed.map((occurrence) => occurrence.id) } }
        });
        await transactionClient.expense.updateMany({
          where: { id: { in: cancelled.map((occurrence) => occurrence.id) } },
          data: { cancelledAt }
        });
        await transactionClient.financeEvent.createMany({
          data: cancelled.map((occurrence) => ({
            userId,
            recordType: 'EXPENSE',
            recordId: occurrence.id,
            type: 'CANCELLED',
            changes: {}
          }))
        });
        await transactionClient.recurringExpense.update({
          where: { id },
          data: { cancelledAt }
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'RECURRING_EXPENSE',
          recordId: id,
          type: 'CANCELLED',
          changes: {
            effectiveFrom,
            removedOccurrences: daysOf(removed),
            cancelledOccurrences: daysOf(cancelled)
          }
        });

        return { outcome: 'written' };
      }
    );
  }

  /** For a series entered by mistake: refused once any occurrence has an active payment. */
  async delete(
    params: RecurringExpenseRepository.GetByIdParams
  ): Promise<RecurringExpenseRepository.Write> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable<RecurringExpenseRepository.Write>(
      async (transactionClient) => {
        const series = await transactionClient.recurringExpense.findFirst({
          where: { id, userId },
          include: { occurrences: { select: { id: true } } }
        });

        if (!series) return { outcome: 'not-found' };

        const occurrenceIds = series.occurrences.map(
          (occurrence) => occurrence.id
        );
        const activePayments = await transactionClient.expensePayment.count({
          where: { expenseId: { in: occurrenceIds }, voidedAt: null }
        });

        if (activePayments > 0) return { outcome: 'has-payments' };

        await transactionClient.expensePayment.deleteMany({
          where: { expenseId: { in: occurrenceIds } }
        });
        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordIds: occurrenceIds
        });
        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'RECURRING_EXPENSE',
          recordIds: [id]
        });
        await transactionClient.expense.deleteMany({
          where: { recurringExpenseId: id }
        });
        await transactionClient.recurringExpense.delete({ where: { id } });

        return { outcome: 'written' };
      }
    );
  }
}

namespace RecurringExpenseRepository {
  export type GetByIdParams = Record<'id' | 'userId', string>;
  export type AddParams = ExpenseDescription & {
    userId: string;
    amount: string;
    isVariable: boolean;
    currency: string;
    frequency: RecurrenceFrequency;
    startDate: Date;
    endDate: Date | null;
    /** The last day occurrences are generated through. */
    through: Date;
  };
  export type UpdateParams = GetByIdParams &
    Partial<ExpenseDescription> &
    Partial<Record<'amount', string>> &
    Partial<Record<'isVariable', boolean>> &
    Partial<Record<'endDate', Date | null>> &
    Record<'effectiveFrom' | 'through', Date>;
  export type CancelParams = GetByIdParams &
    Record<'effectiveFrom' | 'through', Date>;
  export type Write =
    | { outcome: 'written' }
    | { outcome: 'not-found' }
    | { outcome: 'imprecise-amount'; field: string }
    | { outcome: 'cancelled' }
    | { outcome: 'has-payments' }
    | { outcome: 'end-before-start' }
    | { outcome: 'end-before-paid-occurrence' }
    | { outcome: 'effective-after-horizon'; latestEffectiveFrom: string };
}
