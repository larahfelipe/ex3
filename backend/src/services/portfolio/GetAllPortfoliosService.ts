import type { Portfolio } from '@/domain/models';
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

  async execute({
    userId,
    page,
    limit
  }: GetAllPortfoliosService.DTO): Promise<GetAllPortfoliosService.Result> {
    const { pagination, docs: portfolios } =
      await this.portfolioRepository.getAll({ userId, page, limit });

    return { pagination, portfolios };
  }
}

namespace GetAllPortfoliosService {
  export type DTO = Record<'userId', string> & {
    page?: number;
    limit?: number;
  };
  export type Result = {
    portfolios: Array<Omit<Portfolio, 'assets'>>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
  };
}
