import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { CreditCardRepository } from '@/infra/database';

export class DeleteCreditCardService {
  private static INSTANCE: DeleteCreditCardService;
  private readonly creditCardRepository: CreditCardRepository;

  private constructor(creditCardRepository: CreditCardRepository) {
    this.creditCardRepository = creditCardRepository;
  }

  static getInstance(creditCardRepository: CreditCardRepository) {
    if (!DeleteCreditCardService.INSTANCE)
      DeleteCreditCardService.INSTANCE = new DeleteCreditCardService(
        creditCardRepository
      );

    return DeleteCreditCardService.INSTANCE;
  }

  async execute(
    params: DeleteCreditCardService.DTO
  ): Promise<DeleteCreditCardService.Result> {
    const write = await this.creditCardRepository.delete(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.CREDIT_CARD_NOT_FOUND);

    return { message: FinanceMessages.CARD_DELETED };
  }
}

namespace DeleteCreditCardService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}
