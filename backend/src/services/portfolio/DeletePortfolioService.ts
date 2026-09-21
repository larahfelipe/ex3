import { PortfolioMessages } from '@/config';
import { DomainError, NotFoundError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

import type { PortfolioScope } from '../PortfolioAccess';

export class DeletePortfolioService {
  private static INSTANCE: DeletePortfolioService;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(portfolioRepository: PortfolioRepository) {
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(portfolioRepository: PortfolioRepository) {
    if (!DeletePortfolioService.INSTANCE)
      DeletePortfolioService.INSTANCE = new DeletePortfolioService(
        portfolioRepository
      );

    return DeletePortfolioService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId
  }: DeletePortfolioService.DTO): Promise<DeletePortfolioService.Result> {
    const result = await this.portfolioRepository.delete({
      id: portfolioId,
      userId
    });

    if (result.outcome === 'not-found')
      throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    if (result.outcome === 'last-portfolio')
      throw new DomainError(PortfolioMessages.LAST_PORTFOLIO);

    return {
      message: PortfolioMessages.DELETED
    };
  }
}

namespace DeletePortfolioService {
  export type DTO = PortfolioScope;
  export type Result = Record<'message', string>;
}
