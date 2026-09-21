import { PortfolioMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import { DomainError, NotFoundError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

import type { PortfolioScope } from '../PortfolioAccess';

export class UpdatePortfolioService {
  private static INSTANCE: UpdatePortfolioService;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(portfolioRepository: PortfolioRepository) {
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(portfolioRepository: PortfolioRepository) {
    if (!UpdatePortfolioService.INSTANCE)
      UpdatePortfolioService.INSTANCE = new UpdatePortfolioService(
        portfolioRepository
      );

    return UpdatePortfolioService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    name,
    baseCurrency
  }: UpdatePortfolioService.DTO): Promise<UpdatePortfolioService.Result> {
    const result = await this.portfolioRepository.update({
      id: portfolioId,
      userId,
      name,
      baseCurrency
    });

    if (result.outcome === 'not-found')
      throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    if (result.outcome === 'base-currency-locked')
      throw new DomainError(PortfolioMessages.BASE_CURRENCY_LOCKED);

    return {
      portfolio: result.portfolio,
      message: PortfolioMessages.UPDATED
    };
  }
}

namespace UpdatePortfolioService {
  export type DTO = PortfolioScope &
    Partial<Pick<Portfolio, 'name' | 'baseCurrency'>>;
  export type Result = {
    portfolio: Omit<Portfolio, 'positions'>;
    message: string;
  };
}
