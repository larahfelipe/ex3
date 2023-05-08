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

  async execute({ userId }: GetPortfolioService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const res: GetPortfolioService.Result = {
      ...portfolioExists
    };

    return res;
  }
}

namespace GetPortfolioService {
  export type DTO = {
    userId: string;
  };
  export type Result = Omit<Portfolio, 'assets'>;
}
