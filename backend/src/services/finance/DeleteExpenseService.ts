import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { ExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class DeleteExpenseService {
  private static INSTANCE: DeleteExpenseService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!DeleteExpenseService.INSTANCE)
      DeleteExpenseService.INSTANCE = new DeleteExpenseService(
        expenseRepository
      );

    return DeleteExpenseService.INSTANCE;
  }

  async execute(
    params: DeleteExpenseService.DTO
  ): Promise<DeleteExpenseService.Result> {
    const write = await this.expenseRepository.delete(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return { message: FinanceMessages.EXPENSE_DELETED };
  }
}

namespace DeleteExpenseService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}
