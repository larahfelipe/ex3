import type {
  InstallmentPlan as InstallmentPlanRow,
  Prisma
} from '@prisma/client';

import { formatCalendarDay } from '@/domain/CalendarDay';
import {
  describeInstallmentPlan,
  reschedulableInstallments,
  scheduleInstallments,
  type ScheduledInstallment
} from '@/domain/InstallmentSchedule';
import type {
  Expense,
  ExpenseDescription,
  FinanceEvent,
  InstallmentPlan,
  InstallmentPlanStatus,
  RecurrenceFrequency
} from '@/domain/models';
import type { Page } from '@/interfaces';

import {
  billDatesOf,
  cardPaymentMethodOf,
  changesOf,
  chargedCardOf,
  deleteHistoryOf,
  expenseDescriptionOf,
  historyOf,
  impreciseFieldOf,
  OPEN_EXPENSE_WHERE,
  recordedCardOf,
  recordFinanceEvent,
  toCreditCardSummary,
  toExpense,
  UNPAID_EXPENSE_WHERE,
  WITH_CREDIT_CARD,
  type WithCreditCard
} from './FinanceRecords';
import { PrismaClient } from './PrismaClient';

export type InstallmentPlanListQuery = {
  userId: string;
  page: number;
  pageSize: number;
  currency?: string;
  status?: InstallmentPlanStatus;
};

export type InstallmentPlanDetail = InstallmentPlan & {
  installments: Array<Expense>;
  keptThroughInstallment: number | null;
  history: Array<FinanceEvent>;
};

const OWED_INSTALLMENT_WHERE = {
  cancelledAt: null
} as const satisfies Prisma.ExpenseWhereInput;

const PROGRESS_SELECT = {
  installmentNumber: true,
  amount: true,
  settledAmount: true,
  dueDate: true,
  settledOn: true,
  cancelledAt: true
} as const satisfies Prisma.ExpenseSelect;

const statusWhere = (
  status: InstallmentPlanStatus | undefined
): Prisma.InstallmentPlanWhereInput => {
  if (status === 'CANCELLED') return { cancelledAt: { not: null } };
  if (status === 'COMPLETED')
    return {
      cancelledAt: null,
      installments: {
        some: OWED_INSTALLMENT_WHERE,
        none: OPEN_EXPENSE_WHERE
      }
    };
  if (status === 'ACTIVE')
    return {
      cancelledAt: null,
      OR: [
        { installments: { some: OPEN_EXPENSE_WHERE } },
        { installments: { none: OWED_INSTALLMENT_WHERE } }
      ]
    };

  return {};
};

/** The table's check pairs every installment of a plan with its number. */
const numbered = <Row extends { installmentNumber: number | null }>(
  rows: ReadonlyArray<Row>
) =>
  rows.map((row) => {
    if (row.installmentNumber === null)
      throw new Error('An installment row has no installment number');

    return { ...row, installmentNumber: row.installmentNumber };
  });

const PAYMENT_COUNT_INCLUDE = {
  _count: { select: { payments: true } }
} as const satisfies Prisma.ExpenseInclude;

const rescheduleSplitOf = <
  Row extends { installmentNumber: number | null } & Record<
    '_count',
    Record<'payments', number>
  >
>(
  rows: ReadonlyArray<Row>
) => {
  const replaced = reschedulableInstallments(
    numbered(rows).map((row) => ({
      ...row,
      hasPayments: row._count.payments > 0
    }))
  );

  return { kept: rows.slice(0, rows.length - replaced.length), replaced };
};

const ownDueDateOf = ({
  dueDate,
  originalDueDate
}: Record<'dueDate', Date> & Record<'originalDueDate', Date | null>) =>
  originalDueDate ?? dueDate;

const toInstallmentPlan = (
  row: InstallmentPlanRow & WithCreditCard,
  installments: Parameters<typeof describeInstallmentPlan>[0]
): InstallmentPlan => ({
  id: row.id,
  description: row.description,
  category: row.category,
  subcategory: row.subcategory,
  paymentMethod: row.paymentMethod,
  account: row.account,
  notes: row.notes,
  currency: row.currency,
  frequency: row.frequency,
  principalAmount: row.principalAmount?.toFixed() ?? null,
  entryDate: formatCalendarDay(row.entryDate),
  cancelledAt: row.cancelledAt,
  ...describeInstallmentPlan(installments, row),
  creditCardId: row.creditCardId,
  creditCard:
    row.creditCard === null ? null : toCreditCardSummary(row.creditCard),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export class InstallmentPlanRepository {
  private static INSTANCE: InstallmentPlanRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!InstallmentPlanRepository.INSTANCE)
      InstallmentPlanRepository.INSTANCE = new InstallmentPlanRepository();

    return InstallmentPlanRepository.INSTANCE;
  }

  async getAll(
    params: InstallmentPlanListQuery
  ): Promise<Page<InstallmentPlan>> {
    const { userId, page, pageSize, currency, status } = params;

    const where: Prisma.InstallmentPlanWhereInput = {
      AND: [{ userId, currency }, statusWhere(status)]
    };

    const [total, rows] = await Promise.all([
      this.prismaClient.installmentPlan.count({ where }),
      this.prismaClient.installmentPlan.findMany({
        where,
        include: {
          installments: { select: PROGRESS_SELECT },
          ...WITH_CREDIT_CARD
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map(({ installments, ...plan }) =>
        toInstallmentPlan(plan, numbered(installments))
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getById(
    params: InstallmentPlanRepository.GetByIdParams & Record<'today', Date>
  ): Promise<InstallmentPlanDetail | null> {
    const { id, userId, today } = params;

    const row = await this.prismaClient.installmentPlan.findFirst({
      where: { id, userId },
      include: {
        installments: {
          include: { ...PAYMENT_COUNT_INCLUDE, ...WITH_CREDIT_CARD },
          orderBy: { installmentNumber: 'asc' }
        },
        ...WITH_CREDIT_CARD
      }
    });

    if (!row) return null;

    const { installments, ...plan } = row;
    const count = installments.at(-1)?.installmentNumber ?? null;
    const { kept } = rescheduleSplitOf(installments);
    const history = await historyOf(this.prismaClient, {
      userId,
      recordType: 'INSTALLMENT_PLAN',
      recordId: id
    });

    return {
      ...toInstallmentPlan(plan, numbered(installments)),
      installments: installments.map((installment) =>
        toExpense(installment, today, count)
      ),
      keptThroughInstallment: kept.at(-1)?.installmentNumber ?? null,
      history
    };
  }

  async add(
    params: InstallmentPlanRepository.AddParams
  ): Promise<InstallmentPlanRepository.AddWrite> {
    const { userId, installments, creditCardId, ...requested } = params;

    return this.prismaClient.runSerializable<InstallmentPlanRepository.AddWrite>(
      async (transactionClient) => {
        const card = await chargedCardOf(transactionClient, {
          userId,
          creditCardId,
          current: null
        });

        if (card === 'card-not-found') return { outcome: card };

        const paymentMethod =
          card === null
            ? requested.paymentMethod
            : cardPaymentMethodOf(requested.paymentMethod);

        if (paymentMethod === 'card-method-mismatch')
          return { outcome: paymentMethod };

        const plan = { ...requested, paymentMethod };
        const row = await transactionClient.installmentPlan.create({
          data: { ...plan, creditCardId: card?.id ?? null, userId }
        });

        await transactionClient.expense.createMany({
          data: installments.map(({ dueDate, ...installment }) => ({
            ...expenseDescriptionOf(plan),
            ...installment,
            ...billDatesOf(card, dueDate),
            creditCardId: card?.id ?? null,
            currency: plan.currency,
            entryDate: plan.entryDate,
            installmentPlanId: row.id,
            userId
          }))
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'INSTALLMENT_PLAN',
          recordId: row.id,
          type: 'CREATED',
          changes: {
            ...plan,
            installmentCount: installments.length,
            firstDueDate: installments[0].dueDate,
            ...(card !== null && { creditCard: recordedCardOf(card) })
          }
        });

        return { outcome: 'written', id: row.id };
      }
    );
  }

  async update(
    params: InstallmentPlanRepository.UpdateParams
  ): Promise<InstallmentPlanRepository.Write> {
    const { id, userId, creditCardId, ...requested } = params;

    return this.prismaClient.runSerializable<InstallmentPlanRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.installmentPlan.findFirst({
          where: { id, userId },
          include: WITH_CREDIT_CARD
        });

        if (!current) return { outcome: 'not-found' };

        const impreciseField = impreciseFieldOf(
          { principalAmount: requested.principalAmount },
          current.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        const card = await chargedCardOf(transactionClient, {
          userId,
          creditCardId:
            creditCardId === undefined ? current.creditCardId : creditCardId,
          current: current.creditCard
        });

        if (card === 'card-not-found') return { outcome: card };

        const requestedMethod =
          requested.paymentMethod === undefined
            ? current.paymentMethod
            : requested.paymentMethod;
        const paymentMethod =
          card === null
            ? requestedMethod
            : cardPaymentMethodOf(requestedMethod);

        if (paymentMethod === 'card-method-mismatch')
          return { outcome: paymentMethod };

        const patch = {
          ...requested,
          ...((requested.paymentMethod !== undefined ||
            paymentMethod !== current.paymentMethod) && { paymentMethod })
        };
        const isChangingCard = (card?.id ?? null) !== current.creditCardId;
        const changes = {
          ...changesOf(current, patch),
          ...(isChangingCard && {
            creditCard: {
              from: recordedCardOf(current.creditCard),
              to: recordedCardOf(card)
            }
          })
        };

        if (Object.keys(changes).length === 0) return { outcome: 'written' };

        await transactionClient.installmentPlan.update({
          where: { id },
          data: {
            ...patch,
            ...(isChangingCard && { creditCardId: card?.id ?? null })
          }
        });

        const { principalAmount: _, ...description } = patch;

        if (Object.values(description).some((value) => value !== undefined))
          await transactionClient.expense.updateMany({
            where: {
              installmentPlanId: id,
              isCustomized: false,
              ...OPEN_EXPENSE_WHERE
            },
            data: description
          });

        // An installment's card is its plan's alone, so a customized one moves
        // too; one with payments keeps the card and date it was paid against.
        if (isChangingCard) {
          const unpaid = await transactionClient.expense.findMany({
            where: { installmentPlanId: id, ...UNPAID_EXPENSE_WHERE },
            select: { id: true, dueDate: true, originalDueDate: true }
          });

          for (const installment of unpaid)
            await transactionClient.expense.update({
              where: { id: installment.id },
              data: {
                creditCardId: card?.id ?? null,
                ...billDatesOf(card, ownDueDateOf(installment)),
                ...(card !== null && { paymentMethod: 'CREDIT_CARD' })
              }
            });
        }

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'INSTALLMENT_PLAN',
          recordId: id,
          type: 'UPDATED',
          changes
        });

        return { outcome: 'written' };
      }
    );
  }

  async reschedule(
    params: InstallmentPlanRepository.RescheduleParams
  ): Promise<InstallmentPlanRepository.RescheduleWrite> {
    const { id, userId, remainingAmount, remainingCount, nextDueDate } = params;

    return this.prismaClient.runSerializable<InstallmentPlanRepository.RescheduleWrite>(
      async (transactionClient) => {
        const plan = await transactionClient.installmentPlan.findFirst({
          where: { id, userId },
          include: {
            installments: {
              include: PAYMENT_COUNT_INCLUDE,
              orderBy: { installmentNumber: 'asc' }
            },
            ...WITH_CREDIT_CARD
          }
        });

        if (!plan) return { outcome: 'not-found' };
        if (plan.cancelledAt !== null) return { outcome: 'cancelled' };

        const impreciseField = impreciseFieldOf(
          { remainingAmount },
          plan.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        const { kept, replaced } = rescheduleSplitOf(plan.installments);
        const lastKept = kept.at(-1);
        const lastKeptDueDate =
          lastKept === undefined ? undefined : ownDueDateOf(lastKept);

        if (
          lastKeptDueDate !== undefined &&
          nextDueDate.getTime() < lastKeptDueDate.getTime()
        )
          return {
            outcome: 'due-before-kept',
            lastKeptDueDate: formatCalendarDay(lastKeptDueDate)
          };

        const schedule = scheduleInstallments({
          amount: { totalAmount: remainingAmount },
          count: remainingCount,
          firstDueDate: nextDueDate,
          frequency: plan.frequency,
          currency: plan.currency,
          firstNumber: (lastKept?.installmentNumber ?? 0) + 1
        });

        if (schedule === null) return { outcome: 'split-too-small' };

        const replacedIds = replaced.map((installment) => installment.id);

        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordIds: replacedIds
        });
        await transactionClient.expense.deleteMany({
          where: { id: { in: replacedIds } }
        });
        await transactionClient.expense.createMany({
          data: schedule.map(({ dueDate, ...installment }) => ({
            ...expenseDescriptionOf(plan),
            ...installment,
            ...billDatesOf(plan.creditCard, dueDate),
            creditCardId: plan.creditCardId,
            currency: plan.currency,
            entryDate: plan.entryDate,
            installmentPlanId: id,
            userId
          }))
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'INSTALLMENT_PLAN',
          recordId: id,
          type: 'RESCHEDULED',
          changes: {
            replaced: replaced.map((installment) => ({
              installmentNumber: installment.installmentNumber,
              dueDate: formatCalendarDay(installment.dueDate),
              amount: installment.amount.toFixed(),
              cancelled: installment.cancelledAt !== null
            })),
            scheduled: schedule.map((installment) => ({
              ...installment,
              dueDate: formatCalendarDay(installment.dueDate)
            }))
          }
        });

        return { outcome: 'written' };
      }
    );
  }

  async cancel(
    params: InstallmentPlanRepository.GetByIdParams
  ): Promise<InstallmentPlanRepository.Write> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable<InstallmentPlanRepository.Write>(
      async (transactionClient) => {
        const plan = await transactionClient.installmentPlan.findFirst({
          where: { id, userId }
        });

        if (!plan) return { outcome: 'not-found' };
        if (plan.cancelledAt !== null) return { outcome: 'cancelled' };

        const cancelledAt = new Date();
        const cancelled = await transactionClient.expense.findMany({
          where: {
            installmentPlanId: id,
            ...OPEN_EXPENSE_WHERE,
            payments: { none: { voidedAt: null } }
          },
          select: { id: true, installmentNumber: true },
          orderBy: { installmentNumber: 'asc' }
        });

        await transactionClient.installmentPlan.update({
          where: { id },
          data: { cancelledAt }
        });
        await transactionClient.expense.updateMany({
          where: { id: { in: cancelled.map((installment) => installment.id) } },
          data: { cancelledAt }
        });
        await transactionClient.financeEvent.createMany({
          data: cancelled.map((installment) => ({
            userId,
            recordType: 'EXPENSE',
            recordId: installment.id,
            type: 'CANCELLED',
            changes: {}
          }))
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'INSTALLMENT_PLAN',
          recordId: id,
          type: 'CANCELLED',
          changes: {
            cancelledInstallments: cancelled.map(
              (installment) => installment.installmentNumber
            )
          }
        });

        return { outcome: 'written' };
      }
    );
  }

  async delete(
    params: InstallmentPlanRepository.GetByIdParams
  ): Promise<InstallmentPlanRepository.Write> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable<InstallmentPlanRepository.Write>(
      async (transactionClient) => {
        const plan = await transactionClient.installmentPlan.findFirst({
          where: { id, userId },
          include: { installments: { select: { id: true } } }
        });

        if (!plan) return { outcome: 'not-found' };

        const installmentIds = plan.installments.map(
          (installment) => installment.id
        );
        const activePayments = await transactionClient.expensePayment.count({
          where: { expenseId: { in: installmentIds }, voidedAt: null }
        });

        if (activePayments > 0) return { outcome: 'has-payments' };

        await transactionClient.expensePayment.deleteMany({
          where: { expenseId: { in: installmentIds } }
        });
        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordIds: installmentIds
        });
        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'INSTALLMENT_PLAN',
          recordIds: [id]
        });
        await transactionClient.expense.deleteMany({
          where: { installmentPlanId: id }
        });
        await transactionClient.installmentPlan.delete({ where: { id } });

        return { outcome: 'written' };
      }
    );
  }
}

namespace InstallmentPlanRepository {
  export type GetByIdParams = Record<'id' | 'userId', string>;
  export type AddParams = ExpenseDescription & {
    userId: string;
    creditCardId: string | null;
    currency: string;
    frequency: RecurrenceFrequency;
    principalAmount: string | null;
    entryDate: Date;
    installments: Array<ScheduledInstallment>;
  };
  export type UpdateParams = GetByIdParams &
    Partial<ExpenseDescription> &
    Partial<Record<'principalAmount' | 'creditCardId', string | null>>;
  export type RescheduleParams = GetByIdParams & {
    remainingAmount: string;
    remainingCount: number;
    nextDueDate: Date;
  };
  export type Write =
    | { outcome: 'written' }
    | { outcome: 'not-found' }
    | { outcome: 'imprecise-amount'; field: string }
    | { outcome: 'cancelled' }
    | { outcome: 'has-payments' }
    | CardRefusal;
  export type CardRefusal =
    { outcome: 'card-not-found' } | { outcome: 'card-method-mismatch' };
  export type AddWrite = { outcome: 'written'; id: string } | CardRefusal;
  export type RescheduleWrite =
    | Write
    | { outcome: 'split-too-small' }
    | { outcome: 'due-before-kept'; lastKeptDueDate: string };
}
