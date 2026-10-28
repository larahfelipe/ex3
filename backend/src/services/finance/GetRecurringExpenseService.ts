import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type {
  RecurringExpenseDetail,
  RecurringExpenseRepository
} from '@/infra/database';

export class GetRecurringExpenseService {
  private static INSTANCE: GetRecurringExpenseService;
  private readonly recurringExpenseRepository: RecurringExpenseRepository;

  private constructor(recurringExpenseRepository: RecurringExpenseRepository) {
    this.recurringExpenseRepository = recurringExpenseRepository;
  }

  static getInstance(recurringExpenseRepository: RecurringExpenseRepository) {
    if (!GetRecurringExpenseService.INSTANCE)
      GetRecurringExpenseService.INSTANCE = new GetRecurringExpenseService(
        recurringExpenseRepository
      );

    return GetRecurringExpenseService.INSTANCE;
  }

  async execute(
    params: GetRecurringExpenseService.DTO
  ): Promise<GetRecurringExpenseService.Result> {
    const series = await this.recurringExpenseRepository.getById(params);

    if (!series)
      throw new NotFoundError(FinanceMessages.RECURRING_EXPENSE_NOT_FOUND);

    return series;
  }
}

namespace GetRecurringExpenseService {
  export type DTO = Record<'id' | 'userId', string> & Record<'today', Date>;
  export type Result = RecurringExpenseDetail;
}
