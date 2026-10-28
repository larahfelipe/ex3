import {
  addDays,
  addMonths,
  endOfMonth,
  formatCalendarMonth,
  monthsBetween
} from '@/domain/CalendarDay';
import {
  type CategoryFigures,
  type Change,
  changeOf,
  categoryFiguresOf,
  type KindFigures,
  kindFiguresOf,
  type MonthlyFigures,
  monthlyFiguresOf,
  type PeriodTotals,
  totalsOf
} from '@/domain/FinanceAggregates';
import type { CalendarMonth } from '@/domain/models';
import type {
  FinanceReportRepository,
  RecurringExpenseRepository
} from '@/infra/database';

import { generateDueOccurrences } from './OccurrenceHorizon';

/** A span of whole months of one currency, compared with the span of equal length just before it. */
export class GetFinanceReportService {
  private static INSTANCE: GetFinanceReportService;
  private readonly financeReportRepository: FinanceReportRepository;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(
    financeReportRepository: FinanceReportRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    this.financeReportRepository = financeReportRepository;
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(
    financeReportRepository: FinanceReportRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    if (!GetFinanceReportService.INSTANCE)
      GetFinanceReportService.INSTANCE = new GetFinanceReportService(
        financeReportRepository,
        recurringExpenseRepository
      );

    return GetFinanceReportService.INSTANCE;
  }

  async execute({
    userId,
    currency,
    from,
    to,
    today
  }: GetFinanceReportService.DTO): Promise<GetFinanceReportService.Result> {
    await generateDueOccurrences(this.recurringExpenseRepository, {
      userId,
      today
    });

    const months = monthsBetween(from, to);
    const periodTo = endOfMonth(to);
    const previousFrom = addMonths(from, -months.length);
    const previousTo = addDays(from, -1);

    const [currencies, expenses, payments] = await Promise.all([
      this.financeReportRepository.getCurrencies(userId),
      this.financeReportRepository.getExpenseFigures({
        userId,
        currency,
        dueFrom: previousFrom,
        dueTo: periodTo,
        withOpenBefore: false
      }),
      this.financeReportRepository.getPaymentFigures({
        userId,
        currency,
        paidFrom: previousFrom,
        paidTo: periodTo
      })
    ]);

    const period = { from, to: periodTo };
    const totals = totalsOf(expenses, payments, { ...period, today });
    const previous = totalsOf(expenses, payments, {
      from: previousFrom,
      to: previousTo,
      today
    });

    return {
      currency,
      currencies,
      from: formatCalendarMonth(from),
      to: formatCalendarMonth(to),
      totals,
      previous: {
        from: formatCalendarMonth(previousFrom),
        to: formatCalendarMonth(previousTo),
        scheduled: previous.scheduled.amount,
        paid: previous.paid.amount
      },
      change: {
        scheduled: changeOf(totals.scheduled.amount, previous.scheduled.amount),
        paid: changeOf(totals.paid.amount, previous.paid.amount)
      },
      months: monthlyFiguresOf(expenses, payments, months, today),
      categories: categoryFiguresOf(expenses, payments, period),
      kinds: kindFiguresOf(expenses, payments, period)
    };
  }
}

namespace GetFinanceReportService {
  export type DTO = Record<'userId' | 'currency', string> &
    Record<'from' | 'to' | 'today', Date>;
  export type Result = {
    currency: string;
    /** Every currency the user has records in, for choosing which to view. */
    currencies: Array<string>;
    from: CalendarMonth;
    to: CalendarMonth;
    totals: PeriodTotals;
    previous: Record<'from' | 'to', CalendarMonth> &
      Record<'scheduled' | 'paid', string>;
    change: Record<'scheduled' | 'paid', Change>;
    months: Array<MonthlyFigures>;
    categories: Array<CategoryFigures>;
    kinds: Array<KindFigures>;
  };
}
