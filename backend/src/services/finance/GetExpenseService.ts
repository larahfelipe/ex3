import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { ExpenseDetail, ExpenseRepository } from '@/infra/database';

export class GetExpenseService {
  private static INSTANCE: GetExpenseService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!GetExpenseService.INSTANCE)
      GetExpenseService.INSTANCE = new GetExpenseService(expenseRepository);

    return GetExpenseService.INSTANCE;
  }

  async execute(
    params: GetExpenseService.DTO
  ): Promise<GetExpenseService.Result> {
    const expense = await this.expenseRepository.getById(params);

    if (!expense) throw new NotFoundError(FinanceMessages.EXPENSE_NOT_FOUND);

    return expense;
  }
}

namespace GetExpenseService {
  export type DTO = Record<'id' | 'userId', string> & Record<'today', Date>;
  export type Result = ExpenseDetail;
}
