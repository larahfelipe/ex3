import { AssetMessages, TransactionMessages } from '@/config';
import type { Transaction, TransactionEntry } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';
import { ledgerRefusalError } from './LedgerRefusalError';

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
    assetSymbol,
    portfolioId,
    userId,
    ...entry
  }: CreateTransactionService.DTO): Promise<CreateTransactionService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const ledgerWrite = await this.transactionRepository.add({
      ...entry,
      assetSymbol,
      portfolioId: portfolio.id
    });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(AssetMessages.NOT_FOUND);

    if (ledgerWrite.outcome !== 'recorded')
      throw ledgerRefusalError(ledgerWrite);

    return {
      transaction: ledgerWrite.transaction,
      message: TransactionMessages.CREATED
    };
  }
}

namespace CreateTransactionService {
  export type DTO = TransactionEntry &
    Pick<Transaction, 'portfolioId'> &
    Record<'assetSymbol' | 'userId', string>;
  export type Result = {
    transaction: Transaction;
    message: string;
  };
}
