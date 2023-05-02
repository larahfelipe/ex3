import { PortfolioMessages } from '@/constants';
import type { Portfolio, User } from '@/domain/models';
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

  async execute({ id }: GetPortfolioService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(id);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const res: GetPortfolioService.Result = {
      ...portfolioExists
    };

    return res;
  }
}

namespace GetPortfolioService {
  export type DTO = Pick<User, 'id'>;
  export type Result = Omit<Portfolio, 'assets'>;
}
