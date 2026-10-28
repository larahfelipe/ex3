import { FinanceMessages } from '@/config/Constants';
import type { ExpenseDescription } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { ExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class UpdateExpenseService {
  private static INSTANCE: UpdateExpenseService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!UpdateExpenseService.INSTANCE)
      UpdateExpenseService.INSTANCE = new UpdateExpenseService(
        expenseRepository
      );

    return UpdateExpenseService.INSTANCE;
  }

  async execute(
    params: UpdateExpenseService.DTO
  ): Promise<UpdateExpenseService.Result> {
    const write = await this.expenseRepository.update(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return { message: FinanceMessages.EXPENSE_UPDATED };
  }
}

namespace UpdateExpenseService {
  export type DTO = Record<'id' | 'userId', string> &
    Partial<ExpenseDescription> &
    Partial<Record<'amount', string>> &
    Partial<Record<'dueDate' | 'entryDate', Date>> &
    Partial<Record<'cancelled', boolean>>;
  export type Result = Record<'message', string>;
}
