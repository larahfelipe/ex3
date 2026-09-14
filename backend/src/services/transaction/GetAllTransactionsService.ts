import { PortfolioMessages } from '@/config';
import { NotFoundError } from '@/errors';
import type {
  ListedTransaction,
  PortfolioRepository,
  TransactionListQuery,
  TransactionRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

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
    const portfolio = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

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
