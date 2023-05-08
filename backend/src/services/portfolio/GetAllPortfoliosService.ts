import { DefaultErrorMessages } from '@/config';
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

  async execute({ userIsStaff }: GetAllPortfoliosService.DTO) {
    if (!userIsStaff) throw new ForbiddenError(DefaultErrorMessages.FORBIDDEN);

    const allPortfolios = await this.portfolioRepository.getAll();

    const res: GetAllPortfoliosService.Result = {
      portfolios: allPortfolios as Array<Portfolio>
    };

    return res;
  }
}

namespace GetAllPortfoliosService {
  export type DTO = {
    userIsStaff: boolean;
  };
  export type Result = Record<'portfolios', Array<Portfolio>>;
}
