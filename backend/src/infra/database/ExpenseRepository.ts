import type { Prisma } from '@prisma/client';

import { SortOrderTypes } from '@/config/Constants';
import { settleExpense } from '@/domain/ExpenseSettlement';
import { decimalOf } from '@/domain/FinanceMoney';
import type {
  Expense,
  ExpenseCategory,
  ExpenseDescription,
  ExpenseKind,
  ExpensePayment,
  ExpenseStatusFilter,
  FinanceEvent,
  PaymentMethod
} from '@/domain/models';
import type { Page } from '@/interfaces';

import {
  changesOf,
  deleteHistoryOf,
  historyOf,
  impreciseFieldOf,
  installmentCountsOf,
  kindWhere,
  recordFinanceEvent,
  statusWhere,
  toExpense,
  toPayment
} from './FinanceRecords';
import { PrismaClient } from './PrismaClient';

export type ExpenseListQuery = {
  userId: string;
  today: Date;
  page: number;
  pageSize: number;
  sortBy: 'dueDate' | 'amount' | 'description' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  search?: string;
  status?: ExpenseStatusFilter;
  kind?: ExpenseKind;
  category?: ExpenseCategory;
  currency?: string;
  dueFrom?: Date;
  dueTo?: Date;
  minAmount?: string;
  maxAmount?: string;
  installmentPlanId?: string;
  recurringExpenseId?: string;
};

export type PaymentEntry = {
  amount: string;
  discount: string;
  fees: string;
  paidOn: Date;
  method: PaymentMethod | null;
  notes: string | null;
};

export type PaymentListQuery = {
  userId: string;
  currency?: string;
  paidFrom?: Date;
  paidTo?: Date;
  includeVoided: boolean;
  page: number;
  pageSize: number;
};

export type ExpenseDetail = Expense & {
  payments: Array<ExpensePayment>;
  history: Array<FinanceEvent>;
};

export type ListedPayment = ExpensePayment &
  Pick<Expense, 'description' | 'category' | 'currency'>;

const PAYMENT_ORDER = [
  { paidOn: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' }
] as const satisfies Array<Prisma.ExpensePaymentOrderByWithRelationInput>;

/**
 * Every read and write is filtered by the owner, so an id taken from a request
 * never reaches another user's rows; a write by id follows its lookup inside
 * the same serializable transaction, so the payments a settlement is computed
 * from cannot change before it commits.
 */
export class ExpenseRepository {
  private static INSTANCE: ExpenseRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!ExpenseRepository.INSTANCE)
      ExpenseRepository.INSTANCE = new ExpenseRepository();

    return ExpenseRepository.INSTANCE;
  }

  async getAll(params: ExpenseListQuery): Promise<Page<Expense>> {
    const {
      userId,
      today,
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      status,
      kind,
      category,
      currency,
      dueFrom,
      dueTo,
      minAmount,
      maxAmount,
      installmentPlanId,
      recurringExpenseId
    } = params;

    const where: Prisma.ExpenseWhereInput = {
      AND: [
        {
          userId,
          category,
          currency,
          installmentPlanId,
          recurringExpenseId,
          dueDate: { gte: dueFrom, lte: dueTo },
          amount: { gte: minAmount, lte: maxAmount }
        },
        statusWhere(status, today),
        kindWhere(kind),
        search === undefined
          ? {}
          : {
              OR: [
                { description: { contains: search, mode: 'insensitive' } },
                { subcategory: { contains: search, mode: 'insensitive' } },
                { account: { contains: search, mode: 'insensitive' } }
              ]
            }
      ]
    };

    const tieBreaker =
      sortBy === 'dueDate'
        ? [{ createdAt: SortOrderTypes.ASCENDENT }]
        : [{ dueDate: SortOrderTypes.ASCENDENT }];

    const [total, rows] = await Promise.all([
      this.prismaClient.expense.count({ where }),
      this.prismaClient.expense.findMany({
        where,
        orderBy: [
          { [sortBy]: sortOrder },
          ...tieBreaker,
          { installmentNumber: SortOrderTypes.ASCENDENT },
          { id: SortOrderTypes.ASCENDENT }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const counts = await installmentCountsOf(this.prismaClient, [
      ...new Set(
        rows.flatMap(({ installmentPlanId: planId }) =>
          planId === null ? [] : [planId]
        )
      )
    ]);

    return {
      items: rows.map((row) =>
        toExpense(
          row,
          today,
          row.installmentPlanId === null
            ? null
            : (counts.get(row.installmentPlanId) ?? null)
        )
      ),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getById(
    params: ExpenseRepository.GetByIdParams & Record<'today', Date>
  ): Promise<ExpenseDetail | null> {
    const { id, userId, today } = params;

    const row = await this.prismaClient.expense.findFirst({
      where: { id, userId },
      include: { payments: { orderBy: PAYMENT_ORDER } }
    });

    if (!row) return null;

    const { payments, ...expense } = row;
    const counts = await installmentCountsOf(
      this.prismaClient,
      expense.installmentPlanId === null ? [] : [expense.installmentPlanId]
    );
    const history = await historyOf(this.prismaClient, {
      userId,
      recordType: 'EXPENSE',
      recordId: id
    });

    return {
      ...toExpense(
        expense,
        today,
        expense.installmentPlanId === null
          ? null
          : (counts.get(expense.installmentPlanId) ?? null)
      ),
      payments: payments.map(toPayment),
      history
    };
  }

  /** The new expense owes its whole amount: creating it records no payment. */
  async add(params: ExpenseRepository.AddParams) {
    const { userId, ...expense } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      const row = await transactionClient.expense.create({
        data: { ...expense, userId }
      });

      await recordFinanceEvent(transactionClient, {
        userId,
        recordType: 'EXPENSE',
        recordId: row.id,
        type: 'CREATED',
        changes: expense
      });

      return row.id;
    });
  }

  /**
   * An edit of an installment or occurrence marks it customized, so edits of
   * its plan or series leave it as it is. A new amount is checked against what
   * the payments already settled and resettles the expense.
   */
  async update(
    params: ExpenseRepository.UpdateParams
  ): Promise<ExpenseRepository.Write> {
    const { id, userId, cancelled, ...patch } = params;

    return this.prismaClient.runSerializable<ExpenseRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.expense.findFirst({
          where: { id, userId },
          include: {
            payments: { where: { voidedAt: null } },
            installmentPlan: { select: { cancelledAt: true } },
            recurringExpense: { select: { cancelledAt: true } }
          }
        });

        if (!current) return { outcome: 'not-found' };

        const impreciseField = impreciseFieldOf(
          { amount: patch.amount },
          current.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        const settlement = settleExpense(
          patch.amount ?? current.amount,
          current.payments
        );

        if (settlement.outcome === 'over-settled')
          return { outcome: 'below-settled' };

        const changes = changesOf(current, patch);
        const isCancelling = cancelled === true && current.cancelledAt === null;
        const isRestoring = cancelled === false && current.cancelledAt !== null;

        if (isCancelling && current.payments.length > 0)
          return { outcome: 'has-payments' };

        if (
          isRestoring &&
          (current.installmentPlan?.cancelledAt ||
            current.recurringExpense?.cancelledAt)
        )
          return { outcome: 'origin-cancelled' };

        const hasOrigin =
          current.installmentPlanId !== null ||
          current.recurringExpenseId !== null;

        await transactionClient.expense.update({
          where: { id },
          data: {
            ...patch,
            settledAmount: settlement.settledAmount,
            settledOn: settlement.settledOn,
            ...(isCancelling && { cancelledAt: new Date() }),
            ...(isRestoring && { cancelledAt: null }),
            ...(hasOrigin &&
              Object.keys(changes).length > 0 && { isCustomized: true })
          }
        });

        if (Object.keys(changes).length > 0)
          await recordFinanceEvent(transactionClient, {
            userId,
            recordType: 'EXPENSE',
            recordId: id,
            type: 'UPDATED',
            changes
          });

        if (isCancelling || isRestoring)
          await recordFinanceEvent(transactionClient, {
            userId,
            recordType: 'EXPENSE',
            recordId: id,
            type: isCancelling ? 'CANCELLED' : 'RESTORED',
            changes: {}
          });

        return { outcome: 'written' };
      }
    );
  }

  /**
   * Only a one-time expense without active payments is deleted, along with its
   * voided payments and its history: deletion is for an expense entered by
   * mistake. Anything else is cancelled, which keeps it.
   */
  async delete(
    params: ExpenseRepository.GetByIdParams
  ): Promise<ExpenseRepository.Write> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable<ExpenseRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.expense.findFirst({
          where: { id, userId },
          include: { payments: { where: { voidedAt: null } } }
        });

        if (!current) return { outcome: 'not-found' };

        if (
          current.installmentPlanId !== null ||
          current.recurringExpenseId !== null
        )
          return { outcome: 'managed-by-origin' };

        if (current.payments.length > 0) return { outcome: 'has-payments' };

        await transactionClient.expensePayment.deleteMany({
          where: { expenseId: id }
        });
        await deleteHistoryOf(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordIds: [id]
        });
        await transactionClient.expense.delete({ where: { id } });

        return { outcome: 'written' };
      }
    );
  }

  async addPayment(
    params: ExpenseRepository.AddPaymentParams
  ): Promise<ExpenseRepository.PaymentWrite> {
    const { expenseId, userId, ...entry } = params;

    return this.prismaClient.runSerializable<ExpenseRepository.PaymentWrite>(
      async (transactionClient) => {
        const expense = await transactionClient.expense.findFirst({
          where: { id: expenseId, userId },
          include: { payments: { where: { voidedAt: null } } }
        });

        if (!expense) return { outcome: 'not-found' };
        if (expense.cancelledAt !== null) return { outcome: 'cancelled' };
        if (expense.settledOn !== null) return { outcome: 'already-settled' };

        const impreciseField = impreciseFieldOf(
          { amount: entry.amount, discount: entry.discount, fees: entry.fees },
          expense.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        const settlement = settleExpense(expense.amount, [
          ...expense.payments,
          { ...entry, voidedAt: null }
        ]);

        if (settlement.outcome === 'over-settled')
          return { outcome: 'exceeds-outstanding' };

        const payment = await transactionClient.expensePayment.create({
          data: { ...entry, expenseId, userId }
        });

        await transactionClient.expense.update({
          where: { id: expenseId },
          data: {
            settledAmount: settlement.settledAmount,
            settledOn: settlement.settledOn
          }
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordId: expenseId,
          type: 'PAYMENT_RECORDED',
          changes: { paymentId: payment.id, ...entry }
        });

        return { outcome: 'written', payment: toPayment(payment) };
      }
    );
  }

  /** A correction replaces the payment's values and resettles the expense; the history keeps the previous ones. */
  async updatePayment(
    params: ExpenseRepository.UpdatePaymentParams
  ): Promise<ExpenseRepository.PaymentWrite> {
    const { expenseId, paymentId, userId, ...patch } = params;

    return this.prismaClient.runSerializable<ExpenseRepository.PaymentWrite>(
      async (transactionClient) => {
        const expense = await transactionClient.expense.findFirst({
          where: { id: expenseId, userId },
          include: { payments: { where: { voidedAt: null } } }
        });
        const current = expense?.payments.find(({ id }) => id === paymentId);

        if (!expense || !current) return { outcome: 'not-found' };

        const impreciseField = impreciseFieldOf(
          { amount: patch.amount, discount: patch.discount, fees: patch.fees },
          expense.currency
        );

        if (impreciseField !== null)
          return { outcome: 'imprecise-amount', field: impreciseField };

        const corrected = {
          ...current,
          amount: patch.amount ?? current.amount,
          discount: patch.discount ?? current.discount,
          paidOn: patch.paidOn ?? current.paidOn
        };

        if (decimalOf(corrected.amount).plus(corrected.discount).isZero())
          return { outcome: 'empty-payment' };

        const settlement = settleExpense(
          expense.amount,
          expense.payments.map((payment) =>
            payment.id === paymentId ? corrected : payment
          )
        );

        if (settlement.outcome === 'over-settled')
          return { outcome: 'exceeds-outstanding' };

        const changes = changesOf(current, patch);
        const payment = await transactionClient.expensePayment.update({
          where: { id: paymentId },
          data: patch
        });

        await transactionClient.expense.update({
          where: { id: expenseId },
          data: {
            settledAmount: settlement.settledAmount,
            settledOn: settlement.settledOn
          }
        });

        if (Object.keys(changes).length > 0)
          await recordFinanceEvent(transactionClient, {
            userId,
            recordType: 'EXPENSE',
            recordId: expenseId,
            type: 'PAYMENT_CORRECTED',
            changes: { paymentId, ...changes }
          });

        return { outcome: 'written', payment: toPayment(payment) };
      }
    );
  }

  /** A voided payment is kept, marked, and settles nothing from then on. */
  async voidPayment(
    params: ExpenseRepository.PaymentParams
  ): Promise<ExpenseRepository.Write> {
    const { expenseId, paymentId, userId } = params;

    return this.prismaClient.runSerializable<ExpenseRepository.Write>(
      async (transactionClient) => {
        const expense = await transactionClient.expense.findFirst({
          where: { id: expenseId, userId },
          include: { payments: { where: { voidedAt: null } } }
        });
        const current = expense?.payments.find(({ id }) => id === paymentId);

        if (!expense || !current) return { outcome: 'not-found' };

        const settlement = settleExpense(
          expense.amount,
          expense.payments.filter(({ id }) => id !== paymentId)
        );

        if (settlement.outcome === 'over-settled')
          throw new Error('Removing a payment cannot over-settle an expense');

        await transactionClient.expensePayment.update({
          where: { id: paymentId },
          data: { voidedAt: new Date() }
        });

        await transactionClient.expense.update({
          where: { id: expenseId },
          data: {
            settledAmount: settlement.settledAmount,
            settledOn: settlement.settledOn
          }
        });

        await recordFinanceEvent(transactionClient, {
          userId,
          recordType: 'EXPENSE',
          recordId: expenseId,
          type: 'PAYMENT_VOIDED',
          changes: {
            paymentId,
            amount: current.amount,
            discount: current.discount,
            fees: current.fees,
            paidOn: current.paidOn
          }
        });

        return { outcome: 'written' };
      }
    );
  }

  /** Most recent payment day first. */
  async getPayments(params: PaymentListQuery): Promise<Page<ListedPayment>> {
    const {
      userId,
      currency,
      paidFrom,
      paidTo,
      includeVoided,
      page,
      pageSize
    } = params;

    const where: Prisma.ExpensePaymentWhereInput = {
      userId,
      paidOn: { gte: paidFrom, lte: paidTo },
      ...(!includeVoided && { voidedAt: null }),
      ...(currency !== undefined && { expense: { currency } })
    };

    const [total, rows] = await Promise.all([
      this.prismaClient.expensePayment.count({ where }),
      this.prismaClient.expensePayment.findMany({
        where,
        include: {
          expense: {
            select: { description: true, category: true, currency: true }
          }
        },
        orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map(({ expense, ...payment }) => ({
        ...toPayment(payment),
        ...expense
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

namespace ExpenseRepository {
  export type GetByIdParams = Record<'id' | 'userId', string>;
  export type AddParams = ExpenseDescription &
    Pick<Expense, 'amount' | 'currency'> &
    Record<'dueDate' | 'entryDate', Date> &
    Record<'userId', string>;
  export type UpdateParams = GetByIdParams &
    Partial<ExpenseDescription> &
    Partial<Pick<Expense, 'amount'>> &
    Partial<Record<'dueDate' | 'entryDate', Date>> &
    Partial<Record<'cancelled', boolean>>;
  export type AddPaymentParams = PaymentEntry &
    Record<'expenseId' | 'userId', string>;
  export type PaymentParams = Record<
    'expenseId' | 'paymentId' | 'userId',
    string
  >;
  export type UpdatePaymentParams = PaymentParams & Partial<PaymentEntry>;
  export type Write =
    | { outcome: 'written' }
    | { outcome: 'not-found' }
    | { outcome: 'imprecise-amount'; field: string }
    | { outcome: 'below-settled' }
    | { outcome: 'has-payments' }
    | { outcome: 'origin-cancelled' }
    | { outcome: 'managed-by-origin' };
  export type PaymentWrite =
    | { outcome: 'written'; payment: ExpensePayment }
    | { outcome: 'not-found' }
    | { outcome: 'cancelled' }
    | { outcome: 'already-settled' }
    | { outcome: 'imprecise-amount'; field: string }
    | { outcome: 'empty-payment' }
    | { outcome: 'exceeds-outstanding' };
}
