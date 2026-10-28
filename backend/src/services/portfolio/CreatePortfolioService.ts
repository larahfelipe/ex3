import { PortfolioMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import type { PortfolioRepository } from '@/infra/database';

import { portfolioNameTakenError } from './PortfolioNameTaken';

export class CreatePortfolioService {
  private static INSTANCE: CreatePortfolioService;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(portfolioRepository: PortfolioRepository) {
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(portfolioRepository: PortfolioRepository) {
    if (!CreatePortfolioService.INSTANCE)
      CreatePortfolioService.INSTANCE = new CreatePortfolioService(
        portfolioRepository
      );

    return CreatePortfolioService.INSTANCE;
  }

  async execute({
    userId,
    name,
    baseCurrency
  }: CreatePortfolioService.DTO): Promise<CreatePortfolioService.Result> {
    const result = await this.portfolioRepository.add({
      userId,
      name,
      baseCurrency
    });

    if (result.outcome === 'name-taken') throw portfolioNameTakenError();

    return {
      portfolio: result.portfolio,
      message: PortfolioMessages.CREATED
    };
  }
}

namespace CreatePortfolioService {
  export type DTO = Pick<Portfolio, 'userId' | 'name' | 'baseCurrency'>;
  export type Result = {
    portfolio: Omit<Portfolio, 'positions'>;
    message: string;
  };
}
