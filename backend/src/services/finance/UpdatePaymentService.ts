import { FinanceMessages } from '@/config/Constants';
import type { ExpensePayment } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { ExpenseRepository, PaymentEntry } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

/** A correction: the previous values stay in the expense's history. */
export class UpdatePaymentService {
  private static INSTANCE: UpdatePaymentService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!UpdatePaymentService.INSTANCE)
      UpdatePaymentService.INSTANCE = new UpdatePaymentService(
        expenseRepository
      );

    return UpdatePaymentService.INSTANCE;
  }

  async execute(
    params: UpdatePaymentService.DTO
  ): Promise<UpdatePaymentService.Result> {
    const write = await this.expenseRepository.updatePayment(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.PAYMENT_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return {
      payment: write.payment,
      message: FinanceMessages.PAYMENT_UPDATED
    };
  }
}

namespace UpdatePaymentService {
  export type DTO = Partial<PaymentEntry> &
    Record<'expenseId' | 'paymentId' | 'userId', string>;
  export type Result = {
    payment: ExpensePayment;
    message: string;
  };
}
