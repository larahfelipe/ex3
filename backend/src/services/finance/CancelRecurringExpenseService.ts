import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import { NotFoundError } from '@/errors';
import type { RecurringExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';
import { occurrenceHorizonOf } from './OccurrenceHorizon';

export class CancelRecurringExpenseService {
  private static INSTANCE: CancelRecurringExpenseService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!CancelRecurringExpenseService.INSTANCE)
      CancelRecurringExpenseService.INSTANCE =
        new CancelRecurringExpenseService(recurringExpenseRepository);

    return CancelRecurringExpenseService.INSTANCE;
  }

  async execute({
    effectiveFrom,
    ...series
  }: CancelRecurringExpenseService.DTO): Promise<CancelRecurringExpenseService.Result> {
    const write = await this.recurringExpenseRepository.cancel({
      ...series,
      effectiveFrom: effectiveFrom ?? utcToday(),
      through: occurrenceHorizonOf(utcToday())
    });

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.RECURRING_EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'RECURRING_EXPENSE');

    return { message: FinanceMessages.SERIES_CANCELLED_SUCCESSFULLY };
  }
}

namespace CancelRecurringExpenseService {
  export type DTO = Record<'id' | 'userId', string> &
    Partial<Record<'effectiveFrom', Date>>;
  export type Result = Record<'message', string>;
}
