import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import type { ExpenseDescription, RecurrenceFrequency } from '@/domain/models';
import type { RecurringExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';
import { occurrenceHorizonOf } from './OccurrenceHorizon';

export class CreateRecurringExpenseService {
  private static INSTANCE: CreateRecurringExpenseService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!CreateRecurringExpenseService.INSTANCE)
      CreateRecurringExpenseService.INSTANCE =
        new CreateRecurringExpenseService(recurringExpenseRepository);

    return CreateRecurringExpenseService.INSTANCE;
  }

  async execute(
    series: CreateRecurringExpenseService.DTO
  ): Promise<CreateRecurringExpenseService.Result> {
    const write = await this.recurringExpenseRepository.add({
      ...series,
      through: occurrenceHorizonOf(utcToday())
    });

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'RECURRING_EXPENSE');

    return { id: write.id, message: FinanceMessages.SERIES_CREATED };
  }
}

namespace CreateRecurringExpenseService {
  export type DTO = ExpenseDescription &
    Record<'amount' | 'currency' | 'userId', string> &
    Record<'isVariable', boolean> &
    Record<'frequency', RecurrenceFrequency> &
    Record<'startDate', Date> &
    Record<'endDate', Date | null> &
    Record<'creditCardId', string | null>;
  export type Result = Record<'id' | 'message', string>;
}
