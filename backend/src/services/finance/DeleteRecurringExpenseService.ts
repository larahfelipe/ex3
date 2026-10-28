import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { RecurringExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class DeleteRecurringExpenseService {
  private static INSTANCE: DeleteRecurringExpenseService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!DeleteRecurringExpenseService.INSTANCE)
      DeleteRecurringExpenseService.INSTANCE =
        new DeleteRecurringExpenseService(recurringExpenseRepository);

    return DeleteRecurringExpenseService.INSTANCE;
  }

  async execute(
    params: DeleteRecurringExpenseService.DTO
  ): Promise<DeleteRecurringExpenseService.Result> {
    const write = await this.recurringExpenseRepository.delete(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.RECURRING_EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'RECURRING_EXPENSE');

    return { message: FinanceMessages.SERIES_DELETED };
  }
}

namespace DeleteRecurringExpenseService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}
