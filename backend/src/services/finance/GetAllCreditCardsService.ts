import type { CreditCard } from '@/domain/models';
import type { CreditCardRepository } from '@/infra/database';

export class GetAllCreditCardsService {
  private static INSTANCE: GetAllCreditCardsService;
  private readonly creditCardRepository: CreditCardRepository;

  private constructor(creditCardRepository: CreditCardRepository) {
    this.creditCardRepository = creditCardRepository;
  }

  static getInstance(creditCardRepository: CreditCardRepository) {
    if (!GetAllCreditCardsService.INSTANCE)
      GetAllCreditCardsService.INSTANCE = new GetAllCreditCardsService(
        creditCardRepository
      );

    return GetAllCreditCardsService.INSTANCE;
  }

  async execute({
    userId
  }: GetAllCreditCardsService.DTO): Promise<GetAllCreditCardsService.Result> {
    return this.creditCardRepository.getAll(userId);
  }
}

namespace GetAllCreditCardsService {
  export type DTO = Record<'userId', string>;
  export type Result = Array<CreditCard>;
}
