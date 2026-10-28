import type { RecurringExpense } from '@/domain/models';
import type {
  RecurringExpenseListQuery,
  RecurringExpenseRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

export class GetAllRecurringExpensesService {
  private static INSTANCE: GetAllRecurringExpensesService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!GetAllRecurringExpensesService.INSTANCE)
      GetAllRecurringExpensesService.INSTANCE =
        new GetAllRecurringExpensesService(recurringExpenseRepository);

    return GetAllRecurringExpensesService.INSTANCE;
  }

  async execute(
    query: GetAllRecurringExpensesService.DTO
  ): Promise<GetAllRecurringExpensesService.Result> {
    return this.recurringExpenseRepository.getAll(query);
  }
}

namespace GetAllRecurringExpensesService {
  export type DTO = RecurringExpenseListQuery;
  export type Result = Page<RecurringExpense>;
}
