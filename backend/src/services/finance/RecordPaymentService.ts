import { FinanceMessages } from '@/config/Constants';
import type { ExpensePayment } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { ExpenseRepository, PaymentEntry } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class RecordPaymentService {
  private static INSTANCE: RecordPaymentService;
  private readonly expenseRepository: ExpenseRepository;

  private constructor(expenseRepository: ExpenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  static getInstance(expenseRepository: ExpenseRepository) {
    if (!RecordPaymentService.INSTANCE)
      RecordPaymentService.INSTANCE = new RecordPaymentService(
        expenseRepository
      );

    return RecordPaymentService.INSTANCE;
  }

  async execute(
    params: RecordPaymentService.DTO
  ): Promise<RecordPaymentService.Result> {
    const write = await this.expenseRepository.addPayment(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.EXPENSE_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'EXPENSE');

    return {
      payment: write.payment,
      message: FinanceMessages.PAYMENT_RECORDED
    };
  }
}

namespace RecordPaymentService {
  export type DTO = PaymentEntry & Record<'expenseId' | 'userId', string>;
  export type Result = {
    payment: ExpensePayment;
    message: string;
  };
}
