import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import type { ExpenseDescription } from '@/domain/models';
import type { ExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class CreateExpenseService {
  private static INSTANCE: CreateExpenseService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!CreateExpenseService.INSTANCE)
      CreateExpenseService.INSTANCE = new CreateExpenseService(
        expenseRepository
      );

    return CreateExpenseService.INSTANCE;
  }

  async execute({
    entryDate,
    ...expense
  }: CreateExpenseService.DTO): Promise<CreateExpenseService.Result> {
    const write = await this.expenseRepository.add({
      ...expense,
      entryDate: entryDate ?? utcToday()
    });

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return { id: write.id, message: FinanceMessages.EXPENSE_CREATED };
  }
}

namespace CreateExpenseService {
  export type DTO = ExpenseDescription &
    Record<'amount' | 'currency' | 'userId', string> &
    Record<'dueDate', Date> &
    Record<'creditCardId', string | null> &
    Partial<Record<'entryDate', Date>>;
  export type Result = Record<'id' | 'message', string>;
}
