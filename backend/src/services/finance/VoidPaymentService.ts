import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { ExpenseRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class VoidPaymentService {
  private static INSTANCE: VoidPaymentService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!VoidPaymentService.INSTANCE)
      VoidPaymentService.INSTANCE = new VoidPaymentService(expenseRepository);

    return VoidPaymentService.INSTANCE;
  }

  async execute(
    params: VoidPaymentService.DTO
  ): Promise<VoidPaymentService.Result> {
    const write = await this.expenseRepository.voidPayment(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.PAYMENT_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return { message: FinanceMessages.PAYMENT_VOIDED };
  }
}

namespace VoidPaymentService {
  export type DTO = Record<'expenseId' | 'paymentId' | 'userId', string>;
  export type Result = Record<'message', string>;
}
