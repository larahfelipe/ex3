import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import type { ExpenseDescription } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { RecurringExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';
import { occurrenceHorizonOf } from './OccurrenceHorizon';

/** Applies from `effectiveFrom`, the current day by default: what is behind it keeps its values. */
export class UpdateRecurringExpenseService {
  private static INSTANCE: UpdateRecurringExpenseService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!UpdateRecurringExpenseService.INSTANCE)
      UpdateRecurringExpenseService.INSTANCE =
        new UpdateRecurringExpenseService(recurringExpenseRepository);

    return UpdateRecurringExpenseService.INSTANCE;
  }

  async execute({
    effectiveFrom,
    ...series
  }: UpdateRecurringExpenseService.DTO): Promise<UpdateRecurringExpenseService.Result> {
    const write = await this.recurringExpenseRepository.update({
      ...series,
      effectiveFrom: effectiveFrom ?? utcToday(),
      through: occurrenceHorizonOf(utcToday())
    });

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.RECURRING_EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'RECURRING_EXPENSE');

    return { message: FinanceMessages.SERIES_UPDATED };
  }
}

namespace UpdateRecurringExpenseService {
  export type DTO = Record<'id' | 'userId', string> &
    Partial<ExpenseDescription> &
    Partial<Record<'amount', string>> &
    Partial<Record<'isVariable', boolean>> &
    Partial<Record<'endDate', Date | null>> &
    Partial<Record<'effectiveFrom', Date>>;
  export type Result = Record<'message', string>;
}
