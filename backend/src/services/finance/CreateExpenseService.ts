import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import type { ExpenseDescription } from '@/domain/models';
import type { ExpenseRepository } from '@/infra/database';

/** Records what is owed and nothing else: a new expense is never paid until a payment says so. */
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
    const id = await this.expenseRepository.add({
      ...expense,
      entryDate: entryDate ?? utcToday()
    });

    return { id, message: FinanceMessages.EXPENSE_CREATED };
  }
}

namespace CreateExpenseService {
  export type DTO = ExpenseDescription &
    Record<'amount' | 'currency' | 'userId', string> &
    Record<'dueDate', Date> &
    Partial<Record<'entryDate', Date>>;
  export type Result = Record<'id' | 'message', string>;
}
