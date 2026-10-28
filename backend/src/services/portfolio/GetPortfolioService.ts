import type { Portfolio } from '@/domain/models';
import type { PortfolioRepository } from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetPortfolioService {
  private static INSTANCE: GetPortfolioService;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(portfolioRepository: PortfolioRepository) {
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(portfolioRepository: PortfolioRepository) {
    if (!GetPortfolioService.INSTANCE)
      GetPortfolioService.INSTANCE = new GetPortfolioService(
        portfolioRepository
      );

    return GetPortfolioService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId
  }: GetPortfolioService.DTO): Promise<GetPortfolioService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    return { ...portfolio };
  }
}

namespace GetPortfolioService {
  export type DTO = Record<'userId' | 'portfolioId', string>;
  export type Result = Omit<Portfolio, 'positions'>;
}
