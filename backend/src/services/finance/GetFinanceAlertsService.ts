import { FinanceLimits } from '@/config/Constants';
import { addDays } from '@/domain/CalendarDay';
import {
  type CurrencyAmount,
  outstandingByCurrencyOf,
  remindsUpcoming
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

/**
 * The in-app reminders: what is overdue, and what falls due within the user's
 * lead days, each group only when the user's settings ask for it. Nothing is
 * sent anywhere; the app shows them where they are read.
 */
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
    /** The earliest due first, at most `ALERT_ITEMS_LIMIT` of `count`. */
    items: Array<Expense>;
  };
  export type Result = {
    reminders: FinanceSettings;
    overdue: AlertGroup;
    dueSoon: AlertGroup;
  };
}
