import {
  PortfolioMessages,
  TransactionMessages,
  TransactionTypes
} from '@/config';
import type { Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class DeleteTransactionService {
  private static INSTANCE: DeleteTransactionService;
  private readonly transactionRepository: TransactionRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly assetRepository: AssetRepository;

  private constructor(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository,
    assetRepository: AssetRepository
  ) {
    this.transactionRepository = transactionRepository;
    this.portfolioRepository = portfolioRepository;
    this.assetRepository = assetRepository;
  }

  static getInstance(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository,
    assetRepository: AssetRepository
  ) {
    if (!DeleteTransactionService.INSTANCE)
      DeleteTransactionService.INSTANCE = new DeleteTransactionService(
        transactionRepository,
        portfolioRepository,
        assetRepository
      );

    return DeleteTransactionService.INSTANCE;
  }

  async execute({
    id,
    userId
  }: DeleteTransactionService.DTO): Promise<DeleteTransactionService.Result> {
    const portfolioExists = this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const transactionExists = await this.transactionRepository.getById(id);

    if (!transactionExists)
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    await this.transactionRepository.delete(id);

    await this.assetRepository.updatePosition({
      operation:
        transactionExists.type === TransactionTypes.BUY
          ? 'decrement'
          : 'increment',
      amount: transactionExists.amount,
      balance: transactionExists.price * transactionExists.amount,
      symbol: transactionExists.assetSymbol
    });

    return {
      message: TransactionMessages.DELETED
    };
  }
}

namespace DeleteTransactionService {
  export type DTO = Pick<Transaction, 'id'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
