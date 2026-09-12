import { PortfolioMessages, TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class DeleteTransactionService {
  private static INSTANCE: DeleteTransactionService;
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
    if (!DeleteTransactionService.INSTANCE)
      DeleteTransactionService.INSTANCE = new DeleteTransactionService(
        transactionRepository,
        portfolioRepository
      );

    return DeleteTransactionService.INSTANCE;
  }

  async execute({
    id,
    userId
  }: DeleteTransactionService.DTO): Promise<DeleteTransactionService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const ledgerWrite = await this.transactionRepository.delete({
      id,
      portfolioId: portfolioExists.id
    });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    if (ledgerWrite.outcome === 'negative-amount')
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    return {
      message: TransactionMessages.DELETED
    };
  }
}

namespace DeleteTransactionService {
  export type DTO = Pick<Transaction, 'id'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
