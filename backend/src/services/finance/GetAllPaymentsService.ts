import type {
  ExpenseRepository,
  ListedPayment,
  PaymentListQuery
} from '@/infra/database';
import type { Page } from '@/interfaces';

export class GetAllPaymentsService {
  private static INSTANCE: GetAllPaymentsService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!GetAllPaymentsService.INSTANCE)
      GetAllPaymentsService.INSTANCE = new GetAllPaymentsService(
        expenseRepository
      );

    return GetAllPaymentsService.INSTANCE;
  }

  async execute(
    query: GetAllPaymentsService.DTO
  ): Promise<GetAllPaymentsService.Result> {
    return this.expenseRepository.getPayments(query);
  }
}

namespace GetAllPaymentsService {
  export type DTO = PaymentListQuery;
  export type Result = Page<ListedPayment>;
}
