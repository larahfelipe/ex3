import type { Portfolio } from '@/domain/models';
import { ForbiddenError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

export class GetAllPortfoliosService {
  private static INSTANCE: GetAllPortfoliosService;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(portfolioRepository: PortfolioRepository) {
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(portfolioRepository: PortfolioRepository) {
    if (!GetAllPortfoliosService.INSTANCE)
      GetAllPortfoliosService.INSTANCE = new GetAllPortfoliosService(
        portfolioRepository
      );

    return GetAllPortfoliosService.INSTANCE;
  }

  async execute({ userIsAdmin }: GetAllPortfoliosService.DTO) {
    if (!userIsAdmin) throw new ForbiddenError();

    const allPortfolios = await this.portfolioRepository.getAll();

    const res: GetAllPortfoliosService.Result = {
      portfolios: allPortfolios as Array<Portfolio>
    };

    return res;
  }
}

namespace GetAllPortfoliosService {
  export type DTO = Record<'userIsAdmin', boolean>;
  export type Result = Record<'portfolios', Array<Portfolio>>;
}
