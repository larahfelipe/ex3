import type { Portfolio } from '@/domain/models';
import {
  summarizeIncome,
  type PortfolioIncome
} from '@/domain/PortfolioIncome';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetPortfolioIncomeService {
  private static INSTANCE: GetPortfolioIncomeService;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly transactionRepository: TransactionRepository;
  private readonly now: () => Date;

  private constructor(
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    now: () => Date
  ) {
    this.portfolioRepository = portfolioRepository;
    this.transactionRepository = transactionRepository;
    this.now = now;
  }

  static getInstance(
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    now: () => Date = () => new Date()
  ) {
    if (!GetPortfolioIncomeService.INSTANCE)
      GetPortfolioIncomeService.INSTANCE = new GetPortfolioIncomeService(
        portfolioRepository,
        transactionRepository,
        now
      );

    return GetPortfolioIncomeService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId
  }: GetPortfolioIncomeService.DTO): Promise<GetPortfolioIncomeService.Result> {
    const { baseCurrency } = await requireOwnedPortfolio(
      this.portfolioRepository,
      { userId, portfolioId }
    );
    const now = this.now();
    const ledger = await this.transactionRepository.getLedgerUpTo({
      portfolioId,
      to: now
    });

    return summarizeIncome(ledger, baseCurrency, now);
  }
}

namespace GetPortfolioIncomeService {
  export type DTO = Record<'userId', string> &
    Record<'portfolioId', Portfolio['id']>;
  export type Result = PortfolioIncome;
}
