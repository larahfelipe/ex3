import { FinanceMessages } from '@/config/Constants';
import type { CardBrand } from '@/domain/models';
import type { CreditCardRepository } from '@/infra/database';

export class CreateCreditCardService {
  private static INSTANCE: CreateCreditCardService;
  private readonly creditCardRepository: CreditCardRepository;

  private constructor(creditCardRepository: CreditCardRepository) {
    this.creditCardRepository = creditCardRepository;
  }

  static getInstance(creditCardRepository: CreditCardRepository) {
    if (!CreateCreditCardService.INSTANCE)
      CreateCreditCardService.INSTANCE = new CreateCreditCardService(
        creditCardRepository
      );

    return CreateCreditCardService.INSTANCE;
  }

  async execute(
    card: CreateCreditCardService.DTO
  ): Promise<CreateCreditCardService.Result> {
    const id = await this.creditCardRepository.add(card);

    return { id, message: FinanceMessages.CARD_CREATED };
  }
}

namespace CreateCreditCardService {
  export type DTO = Record<'userId' | 'name' | 'lastFourDigits', string> &
    Record<'brand', CardBrand> &
    Record<'closingDay' | 'dueDay', number>;
  export type Result = Record<'id' | 'message', string>;
}
