import type {
  PortfolioRepository,
  TransactionImport,
  TransactionImportRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetAllTransactionImportsService {
  private static INSTANCE: GetAllTransactionImportsService;
  private readonly transactionImportRepository: TransactionImportRepository;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(
    transactionImportRepository: TransactionImportRepository,
    portfolioRepository: PortfolioRepository
  ) {
    this.transactionImportRepository = transactionImportRepository;
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(
    transactionImportRepository: TransactionImportRepository,
    portfolioRepository: PortfolioRepository
  ) {
    if (!GetAllTransactionImportsService.INSTANCE)
      GetAllTransactionImportsService.INSTANCE =
        new GetAllTransactionImportsService(
          transactionImportRepository,
          portfolioRepository
        );

    return GetAllTransactionImportsService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    page,
    pageSize
  }: GetAllTransactionImportsService.DTO): Promise<GetAllTransactionImportsService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    return this.transactionImportRepository.getAll({
      portfolioId: portfolio.id,
      page,
      pageSize
    });
  }
}

namespace GetAllTransactionImportsService {
  export type DTO = Record<'userId' | 'portfolioId', string> &
    Record<'page' | 'pageSize', number>;
  export type Result = Page<TransactionImport>;
}
