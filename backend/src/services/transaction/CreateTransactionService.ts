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

export class CreateTransactionService {
  private static INSTANCE: CreateTransactionService;
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
    if (!CreateTransactionService.INSTANCE)
      CreateTransactionService.INSTANCE = new CreateTransactionService(
        transactionRepository,
        portfolioRepository,
        assetRepository
      );

    return CreateTransactionService.INSTANCE;
  }

  async execute({
    type,
    price,
    amount,
    assetId,
    userId
  }: CreateTransactionService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getById(assetId);

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    if (type === TransactionTypes.SELL && assetExists.amount < amount)
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    const newTransaction = await this.transactionRepository.add({
      type,
      amount,
      price,
      assetId
    });

    await this.assetRepository.updatePosition({
      operation:
        newTransaction.type === TransactionTypes.BUY
          ? 'increment'
          : 'decrement',
      amount: newTransaction.amount,
      balance: newTransaction.price * newTransaction.amount,
      id: newTransaction.assetId
    });

    const res: CreateTransactionService.Result = {
      transaction: newTransaction as Transaction,
      message: TransactionMessages.CREATED
    };

    return res;
  }
}

namespace CreateTransactionService {
  export type DTO = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> &
    Record<'userId', string>;
  export type Result = {
    transaction: Transaction;
    message: string;
  };
}
