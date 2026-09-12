import {
  AssetMessages,
  PortfolioMessages,
  TransactionMessages
} from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class CreateTransactionService {
  private static INSTANCE: CreateTransactionService;
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
    if (!CreateTransactionService.INSTANCE)
      CreateTransactionService.INSTANCE = new CreateTransactionService(
        transactionRepository,
        portfolioRepository
      );

    return CreateTransactionService.INSTANCE;
  }

  async execute({
    type,
    price,
    amount,
    assetSymbol,
    portfolioId,
    userId
  }: CreateTransactionService.DTO): Promise<CreateTransactionService.Result> {
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const ledgerWrite = await this.transactionRepository.add({
      type,
      amount,
      price,
      assetSymbol,
      portfolioId: portfolioExists.id
    });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(AssetMessages.NOT_FOUND);

    if (ledgerWrite.outcome === 'negative-amount')
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    return {
      transaction: ledgerWrite.transaction,
      message: TransactionMessages.CREATED
    };
  }
}

namespace CreateTransactionService {
  export type DTO = Pick<
    Transaction,
    'type' | 'amount' | 'price' | 'portfolioId'
  > &
    Record<'assetSymbol' | 'userId', string>;
  export type Result = {
    transaction: Transaction;
    message: string;
  };
}
