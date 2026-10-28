import type {
  ListedTransaction,
  PortfolioRepository,
  TransactionListQuery,
  TransactionRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetAllTransactionsService {
  private static INSTANCE: GetAllTransactionsService;
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
    if (!GetAllTransactionsService.INSTANCE)
      GetAllTransactionsService.INSTANCE = new GetAllTransactionsService(
        transactionRepository,
        portfolioRepository
      );

    return GetAllTransactionsService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    ...filters
  }: GetAllTransactionsService.DTO): Promise<GetAllTransactionsService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    return this.transactionRepository.getAll({
      ...filters,
      portfolioId: portfolio.id
    });
  }
}

namespace GetAllTransactionsService {
  export type DTO = TransactionListQuery & Record<'userId', string>;
  export type Result = Page<ListedTransaction>;
}
