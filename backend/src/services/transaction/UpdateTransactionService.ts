import {
  AssetMessages,
  PortfolioMessages,
  TransactionMessages,
  TransactionTypes
} from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class UpdateTransactionService {
  private static INSTANCE: UpdateTransactionService;
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
    if (!UpdateTransactionService.INSTANCE)
      UpdateTransactionService.INSTANCE = new UpdateTransactionService(
        transactionRepository,
        portfolioRepository,
        assetRepository
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

    const transactionExists = await this.transactionRepository.getById(id);

    if (!transactionExists)
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol: transactionExists.assetSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    if (type === TransactionTypes.SELL && assetExists.amount < amount)
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    const updatedTransaction = await this.transactionRepository.update({
      id,
      type,
      price,
      amount
    });

    await this.assetRepository.updatePosition({
      operation:
        updatedTransaction.type === TransactionTypes.BUY
          ? 'increment'
          : 'decrement',
      amount: updatedTransaction.amount,
      balance: updatedTransaction.price * updatedTransaction.amount,
      symbol: updatedTransaction.assetSymbol
    });

    return {
      message: TransactionMessages.CREATED
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
