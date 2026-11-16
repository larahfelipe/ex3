import { FinanceMessages } from '@/config/Constants';
import type { CardBrand } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { CreditCardRepository } from '@/infra/database';

import { fieldError } from './FinanceRefusalError';

export class UpdateCreditCardService {
  private static INSTANCE: UpdateCreditCardService;
  private readonly creditCardRepository: CreditCardRepository;

  private constructor(creditCardRepository: CreditCardRepository) {
    this.creditCardRepository = creditCardRepository;
  }

  static getInstance(creditCardRepository: CreditCardRepository) {
    if (!UpdateCreditCardService.INSTANCE)
      UpdateCreditCardService.INSTANCE = new UpdateCreditCardService(
        creditCardRepository
      );

    return UpdateCreditCardService.INSTANCE;
  }

  async execute(
    params: UpdateCreditCardService.DTO
  ): Promise<UpdateCreditCardService.Result> {
    const write = await this.creditCardRepository.update(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.CREDIT_CARD_NOT_FOUND);

    if (write.outcome === 'same-days')
      throw fieldError('dueDay', FinanceMessages.CARD_SAME_DAYS);

    return {
      message: FinanceMessages.CARD_UPDATED,
      movedBills: write.movedBills
    };
  }
}

namespace UpdateCreditCardService {
  export type DTO = Record<'id' | 'userId', string> &
    Partial<Record<'name' | 'lastFourDigits', string>> &
    Partial<Record<'brand', CardBrand>> &
    Partial<Record<'closingDay' | 'dueDay', number>>;
  export type Result = Record<'message', string> & Record<'movedBills', number>;
}
