import type { Prisma } from '@prisma/client';

import { FinanceLimits } from '@/config/Constants';
import { expenseKindOf } from '@/domain/ExpenseSettlement';
import type {
  AggregatePayment,
  AmountCount,
  CurrencyExpense
} from '@/domain/FinanceAggregates';
import { decimalOf } from '@/domain/FinanceMoney';
import type { Expense } from '@/domain/models';

import {
  installmentCountsOf,
  OPEN_EXPENSE_WHERE,
  toExpense
} from './FinanceRecords';
import { PrismaClient } from './PrismaClient';

export type FinanceSettings = Record<'reminderLeadDays', number> &
  Record<
    'remindOverdue' | 'remindUpcomingBills' | 'remindUpcomingInstallments',
    boolean
  >;

/** What a user who never saved settings gets: every reminder, a few days ahead. */
const DEFAULT_SETTINGS: FinanceSettings = {
  reminderLeadDays: FinanceLimits.REMINDER_DEFAULT_LEAD_DAYS,
  remindOverdue: true,
  remindUpcomingBills: true,
  remindUpcomingInstallments: true
};

const SETTINGS_SELECT = {
  reminderLeadDays: true,
  remindOverdue: true,
  remindUpcomingBills: true,
  remindUpcomingInstallments: true
} as const satisfies Prisma.FinanceSettingsSelect;

const AGGREGATE_SELECT = {
  amount: true,
  settledAmount: true,
  dueDate: true,
  settledOn: true,
  cancelledAt: true,
  category: true,
  currency: true,
  installmentPlanId: true,
  recurringExpenseId: true
} as const satisfies Prisma.ExpenseSelect;

/**
 * The rows the dashboard, reports, calendar and alerts aggregate. The sums are
 * taken by the domain, in exact decimals, over the rows of one currency.
 */
export class FinanceReportRepository {
  private static INSTANCE: FinanceReportRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!FinanceReportRepository.INSTANCE)
      FinanceReportRepository.INSTANCE = new FinanceReportRepository();

    return FinanceReportRepository.INSTANCE;
  }

  /**
   * The expenses due from `dueFrom` through `dueTo` and, with
   * `withOpenBefore`, every expense still open that was due earlier, which is
   * what is overdue from before the period.
   */
  async getExpenseFigures(
    params: FinanceReportRepository.ExpenseFiguresQuery
  ): Promise<Array<CurrencyExpense>> {
    const { userId, currency, dueFrom, dueTo, withOpenBefore } = params;

    const rows = await this.prismaClient.expense.findMany({
      where: {
        userId,
        currency,
        OR: [
          { dueDate: { gte: dueFrom, lte: dueTo } },
          ...(withOpenBefore
            ? [{ ...OPEN_EXPENSE_WHERE, dueDate: { lt: dueFrom } }]
            : [])
        ]
      },
      select: AGGREGATE_SELECT
    });

    return rows.map(({ installmentPlanId, recurringExpenseId, ...row }) => ({
      ...row,
      kind: expenseKindOf({ installmentPlanId, recurringExpenseId })
    }));
  }

  /** Active payments made from `paidFrom` through `paidTo`, with the category and origin of their expense. */
  async getPaymentFigures(
    params: FinanceReportRepository.PaymentFiguresQuery
  ): Promise<Array<AggregatePayment>> {
    const { userId, currency, paidFrom, paidTo } = params;

    const rows = await this.prismaClient.expensePayment.findMany({
      where: {
        userId,
        voidedAt: null,
        paidOn: { gte: paidFrom, lte: paidTo },
        expense: { currency }
      },
      select: {
        amount: true,
        fees: true,
        discount: true,
        paidOn: true,
        expense: {
          select: {
            category: true,
            installmentPlanId: true,
            recurringExpenseId: true
          }
        }
      }
    });

    return rows.map(({ expense, ...payment }) => ({
      ...payment,
      category: expense.category,
      kind: expenseKindOf(expense)
    }));
  }

  /** Every currency the user has an expense, plan or series in, alphabetically. */
  async getCurrencies(userId: string) {
    const [expenses, plans, series] = await Promise.all([
      this.prismaClient.expense.findMany({
        where: { userId },
        distinct: ['currency'],
        select: { currency: true }
      }),
      this.prismaClient.installmentPlan.findMany({
        where: { userId },
        distinct: ['currency'],
        select: { currency: true }
      }),
      this.prismaClient.recurringExpense.findMany({
        where: { userId },
        distinct: ['currency'],
        select: { currency: true }
      })
    ]);

    return [
      ...new Set(
        [...expenses, ...plans, ...series].map(({ currency }) => currency)
      )
    ].toSorted();
  }

  /** Open expenses due through `through`, in every currency, earliest first. */
  async getOpenDueThrough(
    params: Record<'userId', string> & Record<'through' | 'today', Date>
  ): Promise<Array<Expense>> {
    const { userId, through, today } = params;

    const rows = await this.prismaClient.expense.findMany({
      where: { userId, ...OPEN_EXPENSE_WHERE, dueDate: { lte: through } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });
    const counts = await installmentCountsOf(this.prismaClient, [
      ...new Set(
        rows.flatMap(({ installmentPlanId }) =>
          installmentPlanId === null ? [] : [installmentPlanId]
        )
      )
    ]);

    return rows.map((row) =>
      toExpense(
        row,
        today,
        row.installmentPlanId === null
          ? null
          : (counts.get(row.installmentPlanId) ?? null)
      )
    );
  }

  /**
   * What the open expenses of the currency still owe, whenever due, except
   * the recurring ones due after `recurringThrough`: a series' later
   * occurrences are projections of what it will cost, not bills owed yet.
   */
  async getOutstanding(
    params: Record<'userId' | 'currency', string> &
      Record<'recurringThrough', Date>
  ): Promise<AmountCount> {
    const { userId, currency, recurringThrough } = params;

    const open = await this.prismaClient.expense.aggregate({
      where: {
        userId,
        currency,
        ...OPEN_EXPENSE_WHERE,
        OR: [
          { recurringExpenseId: null },
          { dueDate: { lte: recurringThrough } }
        ]
      },
      _sum: { amount: true, settledAmount: true },
      _count: true
    });

    return {
      amount: decimalOf(open._sum.amount ?? '0')
        .minus(decimalOf(open._sum.settledAmount ?? '0'))
        .toFixed(),
      count: open._count
    };
  }

  /** What the plans of the currency still owe, whenever due: the contracted part of what is to pay. */
  async getInstallmentSummary(params: Record<'userId' | 'currency', string>) {
    const { userId, currency } = params;

    const [activePlans, open] = await Promise.all([
      this.prismaClient.installmentPlan.count({
        where: {
          userId,
          currency,
          cancelledAt: null,
          installments: { some: OPEN_EXPENSE_WHERE }
        }
      }),
      this.prismaClient.expense.aggregate({
        where: {
          userId,
          currency,
          installmentPlanId: { not: null },
          ...OPEN_EXPENSE_WHERE
        },
        _sum: { amount: true, settledAmount: true },
        _count: true
      })
    ]);

    return {
      activePlans,
      openInstallments: open._count,
      outstanding: decimalOf(open._sum.amount ?? '0')
        .minus(decimalOf(open._sum.settledAmount ?? '0'))
        .toFixed()
    };
  }

  async getSettings(userId: string): Promise<FinanceSettings> {
    const row = await this.prismaClient.financeSettings.findUnique({
      where: { userId },
      select: SETTINGS_SELECT
    });

    return row ?? DEFAULT_SETTINGS;
  }

  async saveSettings(
    params: FinanceSettings & Record<'userId', string>
  ): Promise<FinanceSettings> {
    const { userId, ...settings } = params;

    return this.prismaClient.financeSettings.upsert({
      where: { userId },
      create: { userId, ...settings },
      update: settings,
      select: SETTINGS_SELECT
    });
  }
}

namespace FinanceReportRepository {
  export type ExpenseFiguresQuery = {
    userId: string;
    currency?: string;
    dueFrom: Date;
    dueTo: Date;
    withOpenBefore: boolean;
  };
  export type PaymentFiguresQuery = {
    userId: string;
    currency: string;
    paidFrom: Date;
    paidTo: Date;
  };
}
