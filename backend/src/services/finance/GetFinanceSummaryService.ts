import { FinanceLimits } from '@/config/Constants';
import {
  addMonths,
  endOfMonth,
  formatCalendarDay,
  formatCalendarMonth,
  monthsBetween,
  startOfMonth
} from '@/domain/CalendarDay';
import {
  type AmountCount,
  type CategoryFigures,
  type Change,
  changeOf,
  categoryFiguresOf,
  type CommitmentFigures,
  commitmentsOf,
  dueSoonOf,
  type MonthlyFigures,
  monthlyFiguresOf,
  overdueOf,
  type PeriodTotals,
  remindsUpcoming,
  totalsOf
} from '@/domain/FinanceAggregates';
import { sumOf } from '@/domain/FinanceMoney';
import type {
  CalendarDay,
  CalendarMonth,
  Expense,
  RecurringExpense
} from '@/domain/models';
import type {
  ExpenseRepository,
  FinanceReportRepository,
  FinanceSettings,
  RecurringExpenseRepository
} from '@/infra/database';

import { generateDueOccurrences } from './OccurrenceHorizon';

/**
 * The overview of one currency on the reference day: what is still owed in
 * all, what is overdue and due soon, the current month planned against paid,
 * the months before it, and what is committed for the months ahead.
 */
export class GetFinanceSummaryService {
  private static INSTANCE: GetFinanceSummaryService;
  private readonly financeReportRepository: FinanceReportRepository;
  private readonly expenseRepository: ExpenseRepository;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(
    financeReportRepository: FinanceReportRepository,
    expenseRepository: ExpenseRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    this.financeReportRepository = financeReportRepository;
    this.expenseRepository = expenseRepository;
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(
    financeReportRepository: FinanceReportRepository,
    expenseRepository: ExpenseRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    if (!GetFinanceSummaryService.INSTANCE)
      GetFinanceSummaryService.INSTANCE = new GetFinanceSummaryService(
        financeReportRepository,
        expenseRepository,
        recurringExpenseRepository
      );

    return GetFinanceSummaryService.INSTANCE;
  }

  async execute({
    userId,
    currency,
    today
  }: GetFinanceSummaryService.DTO): Promise<GetFinanceSummaryService.Result> {
    await generateDueOccurrences(this.recurringExpenseRepository, {
      userId,
      today
    });

    const month = startOfMonth(today);
    const previousMonth = addMonths(month, -1);
    const trendMonths = monthsBetween(
      addMonths(month, 1 - FinanceLimits.SUMMARY_TREND_MONTHS),
      month
    );
    const commitmentMonths = monthsBetween(
      month,
      addMonths(month, FinanceLimits.SUMMARY_COMMITMENT_MONTHS - 1)
    );
    const windowFrom = trendMonths[0];

    const [
      settings,
      currencies,
      outstanding,
      expenses,
      payments,
      upcoming,
      installments,
      series
    ] = await Promise.all([
      this.financeReportRepository.getSettings(userId),
      this.financeReportRepository.getCurrencies(userId),
      this.financeReportRepository.getOutstanding({
        userId,
        currency,
        recurringThrough: endOfMonth(month)
      }),
      this.financeReportRepository.getExpenseFigures({
        userId,
        currency,
        dueFrom: windowFrom,
        dueTo: endOfMonth(commitmentMonths[commitmentMonths.length - 1]),
        withOpenBefore: true
      }),
      this.financeReportRepository.getPaymentFigures({
        userId,
        currency,
        paidFrom: windowFrom,
        paidTo: endOfMonth(month)
      }),
      this.expenseRepository.getAll({
        userId,
        today,
        currency,
        status: 'PENDING',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        page: 1,
        pageSize: FinanceLimits.UPCOMING_LIMIT
      }),
      this.financeReportRepository.getInstallmentSummary({
        userId,
        currency
      }),
      this.recurringExpenseRepository.getActive({ userId, currency, today })
    ]);

    const current = totalsOf(expenses, payments, {
      from: month,
      to: endOfMonth(month),
      today
    });
    const previous = totalsOf(expenses, payments, {
      from: previousMonth,
      to: endOfMonth(previousMonth),
      today
    });

    return {
      currency,
      currencies,
      today: formatCalendarDay(today),
      month: formatCalendarMonth(month),
      reminders: settings,
      outstanding,
      overdue: overdueOf(expenses, today),
      dueSoon: dueSoonOf(
        expenses.filter(({ kind }) => remindsUpcoming(kind, settings)),
        today,
        settings.reminderLeadDays
      ),
      current,
      change: {
        scheduled: changeOf(
          current.scheduled.amount,
          previous.scheduled.amount
        ),
        paid: changeOf(current.paid.amount, previous.paid.amount)
      },
      trend: monthlyFiguresOf(expenses, payments, trendMonths, today),
      commitments: commitmentsOf(expenses, commitmentMonths),
      categories: categoryFiguresOf(expenses, payments, {
        from: month,
        to: endOfMonth(month)
      }),
      installments,
      recurring: {
        activeSeries: series.length,
        monthlyEquivalent: sumOf(
          series.map(({ monthlyEquivalent }) => monthlyEquivalent)
        ).toFixed(),
        series
      },
      upcoming: upcoming.items
    };
  }
}

namespace GetFinanceSummaryService {
  export type DTO = Record<'userId' | 'currency', string> &
    Record<'today', Date>;
  export type Result = {
    currency: string;
    /** Every currency the user has records in, for choosing which to view. */
    currencies: Array<string>;
    today: CalendarDay;
    month: CalendarMonth;
    reminders: FinanceSettings;
    /**
     * Every open expense, whenever due, except the recurring ones due after
     * the current month: those are projections, in `commitments`.
     */
    outstanding: AmountCount;
    overdue: AmountCount;
    /** The open expenses due within the lead days, of the kinds the reminders cover. */
    dueSoon: AmountCount;
    /** The current month: scheduled is what was planned, paid what actually left. */
    current: PeriodTotals;
    /** The current month against the previous one. */
    change: Record<'scheduled' | 'paid', Change>;
    trend: Array<MonthlyFigures>;
    /** What is still to pay in the current month and the ones after it, by origin. */
    commitments: Array<CommitmentFigures>;
    categories: Array<CategoryFigures>;
    installments: {
      activePlans: number;
      openInstallments: number;
      outstanding: string;
    };
    recurring: {
      activeSeries: number;
      /** What the active series cost a month on average: a projection, not a contracted amount. */
      monthlyEquivalent: string;
      series: Array<RecurringExpense>;
    };
    upcoming: Array<Expense>;
  };
}
