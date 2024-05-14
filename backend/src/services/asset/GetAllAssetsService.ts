import { PortfolioMessages, type SortOrderTypes } from '@/config';
import type { Asset } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class GetAllAssetsService {
  private static INSTANCE: GetAllAssetsService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository
  ) {
    if (!GetAllAssetsService.INSTANCE)
      GetAllAssetsService.INSTANCE = new GetAllAssetsService(
        assetRepository,
        portfolioRepository
      );

    return GetAllAssetsService.INSTANCE;
  }

  async execute({
    userId,
    page,
    limit,
    sort
  }: GetAllAssetsService.DTO): Promise<GetAllAssetsService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { pagination, docs: assets } = await this.assetRepository.getAll({
      page,
      limit,
      sort,
      portfolioId: portfolioExists.id
    });

    return {
      ...(sort && { sort: { field: 'balance', order: sort } }),
      pagination,
      assets: assets as Array<Asset>
    };
  }
}

namespace GetAllAssetsService {
  export type DTO = {
    userId: string;
    page?: number;
    limit?: number;
    sort?: (typeof SortOrderTypes)[keyof typeof SortOrderTypes];
  };
  export type Result = {
    assets: Array<Asset>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
    sort?: Record<'field' | 'order', string>;
  };
}
