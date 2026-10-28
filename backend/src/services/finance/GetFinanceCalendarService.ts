import {
  endOfMonth,
  formatCalendarMonth,
  startOfMonth
} from '@/domain/CalendarDay';
import {
  type CalendarDayFigures,
  calendarDaysOf
} from '@/domain/FinanceAggregates';
import type { CalendarMonth } from '@/domain/models';
import type {
  FinanceReportRepository,
  RecurringExpenseRepository
} from '@/infra/database';

import { generateDueOccurrences } from './OccurrenceHorizon';

/** The days of a month with something due; a day's expenses are listed by filtering expenses on it. */
export class GetFinanceCalendarService {
  private static INSTANCE: GetFinanceCalendarService;
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
    if (!GetFinanceCalendarService.INSTANCE)
      GetFinanceCalendarService.INSTANCE = new GetFinanceCalendarService(
        financeReportRepository,
        recurringExpenseRepository
      );

    return GetFinanceCalendarService.INSTANCE;
  }

  async execute({
    userId,
    month,
    currency,
    today
  }: GetFinanceCalendarService.DTO): Promise<GetFinanceCalendarService.Result> {
    await generateDueOccurrences(this.recurringExpenseRepository, {
      userId,
      today
    });

    const expenses = await this.financeReportRepository.getExpenseFigures({
      userId,
      currency,
      dueFrom: startOfMonth(month),
      dueTo: endOfMonth(month),
      withOpenBefore: false
    });

    return {
      month: formatCalendarMonth(month),
      days: calendarDaysOf(expenses, today)
    };
  }
}

namespace GetFinanceCalendarService {
  export type DTO = Record<'userId', string> &
    Partial<Record<'currency', string>> &
    Record<'month' | 'today', Date>;
  export type Result = {
    month: CalendarMonth;
    days: Array<CalendarDayFigures>;
  };
}
