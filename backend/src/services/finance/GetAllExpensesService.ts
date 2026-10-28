import type { Expense } from '@/domain/models';
import type {
  ExpenseListQuery,
  ExpenseRepository,
  RecurringExpenseRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

import { generateDueOccurrences } from './OccurrenceHorizon';

export class GetAllExpensesService {
  private static INSTANCE: GetAllExpensesService;
  private readonly expenseRepository: ExpenseRepository;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(
    expenseRepository: ExpenseRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    this.expenseRepository = expenseRepository;
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(
    expenseRepository: ExpenseRepository,
    recurringExpenseRepository: RecurringExpenseRepository
  ) {
    if (!GetAllExpensesService.INSTANCE)
      GetAllExpensesService.INSTANCE = new GetAllExpensesService(
        expenseRepository,
        recurringExpenseRepository
      );

    return GetAllExpensesService.INSTANCE;
  }

  async execute(
    query: GetAllExpensesService.DTO
  ): Promise<GetAllExpensesService.Result> {
    await generateDueOccurrences(this.recurringExpenseRepository, query);

    return this.expenseRepository.getAll(query);
  }
}

namespace GetAllExpensesService {
  export type DTO = ExpenseListQuery;
  export type Result = Page<Expense>;
}
