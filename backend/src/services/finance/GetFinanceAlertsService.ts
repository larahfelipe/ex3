import { FinanceLimits } from '@/config/Constants';
import { addDays } from '@/domain/CalendarDay';
import {
  outstandingByCurrencyOf,
  remindsUpcoming,
  type CurrencyAmount
} from '@/domain/FinanceAggregates';
import type { Expense } from '@/domain/models';
import type {
  FinanceReportRepository,
  FinanceSettings,
  RecurringExpenseRepository
} from '@/infra/database';

import { generateDueOccurrences } from './OccurrenceHorizon';

const alertGroupOf = (expenses: Array<Expense>) => ({
  count: expenses.length,
  totals: outstandingByCurrencyOf(expenses),
  items: expenses.slice(0, FinanceLimits.ALERT_ITEMS_LIMIT)
});

export class GetFinanceAlertsService {
  private static INSTANCE: GetFinanceAlertsService;
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
    if (!GetFinanceAlertsService.INSTANCE)
      GetFinanceAlertsService.INSTANCE = new GetFinanceAlertsService(
        financeReportRepository,
        recurringExpenseRepository
      );

    return GetFinanceAlertsService.INSTANCE;
  }

  async execute({
    userId,
    today
  }: GetFinanceAlertsService.DTO): Promise<GetFinanceAlertsService.Result> {
    await generateDueOccurrences(this.recurringExpenseRepository, {
      userId,
      today
    });

    const reminders = await this.financeReportRepository.getSettings(userId);
    const open = await this.financeReportRepository.getOpenDueThrough({
      userId,
      through: addDays(today, reminders.reminderLeadDays),
      today
    });

    return {
      reminders,
      overdue: alertGroupOf(
        reminders.remindOverdue
          ? open.filter(({ status }) => status === 'OVERDUE')
          : []
      ),
      dueSoon: alertGroupOf(
        open.filter(
          ({ status, kind }) =>
            status === 'PENDING' && remindsUpcoming(kind, reminders)
        )
      )
    };
  }
}

namespace GetFinanceAlertsService {
  export type DTO = Record<'userId', string> & Record<'today', Date>;
  export type AlertGroup = {
    count: number;
    totals: Array<CurrencyAmount>;
    items: Array<Expense>;
  };
  export type Result = {
    reminders: FinanceSettings;
    overdue: AlertGroup;
    dueSoon: AlertGroup;
  };
}
