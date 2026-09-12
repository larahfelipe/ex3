import { PortfolioMessages, TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class UpdateTransactionService {
  private static INSTANCE: UpdateTransactionService;
  private readonly transactionRepository: TransactionRepository;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository
  ) {
    this.transactionRepository = transactionRepository;
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository
  ) {
    if (!UpdateTransactionService.INSTANCE)
      UpdateTransactionService.INSTANCE = new UpdateTransactionService(
        transactionRepository,
        portfolioRepository
      );

    return UpdateTransactionService.INSTANCE;
  }

  async execute({
    id,
    type,
    price,
    amount,
    userId
  }: UpdateTransactionService.DTO): Promise<UpdateTransactionService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const ledgerWrite = await this.transactionRepository.update({
      id,
      type,
      price,
      amount,
      portfolioId: portfolioExists.id
    });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    if (ledgerWrite.outcome === 'negative-amount')
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    return {
      message: TransactionMessages.UPDATED
    };
  }
}

namespace UpdateTransactionService {
  export type DTO = Omit<
    Transaction,
    'assetSymbol' | 'createdAt' | 'updatedAt'
  > &
    Record<'userId', string>;
  export type Result = Record<'message', string>;
}
