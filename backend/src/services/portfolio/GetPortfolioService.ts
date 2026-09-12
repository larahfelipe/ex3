import { PortfolioMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

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
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    return { ...portfolioExists };
  }
}

namespace GetPortfolioService {
  export type DTO = Record<'userId' | 'portfolioId', string>;
  export type Result = Omit<Portfolio, 'assets'>;
}
