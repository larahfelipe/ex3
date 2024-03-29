import { PortfolioMessages, type SortTypes } from '@/config';
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

  async execute({ userId, userIsAdmin, sort }: GetAllAssetsService.DTO) {
    let allAssets = [];

    if (!userIsAdmin) {
      const portfolioExists = await this.portfolioRepository.getByUserId(
        userId
      );

      if (!portfolioExists)
        throw new NotFoundError(PortfolioMessages.NOT_FOUND);

      allAssets = await this.assetRepository.getAllByPortfolioId({
        sort,
        portfolioId: portfolioExists.id
      });
    } else {
      allAssets = await this.assetRepository.getAll(sort);
    }

    const res: GetAllAssetsService.Result = {
      ...(sort && { sort }),
      assets: allAssets as Array<Asset>
    };

    return res;
  }
}

namespace GetAllAssetsService {
  export type DTO = {
    userId: string;
    userIsAdmin: boolean;
    sort?: (typeof SortTypes)[keyof typeof SortTypes];
  };
  export type Result = {
    assets: Array<Asset>;
    sort?: (typeof SortTypes)[keyof typeof SortTypes];
  };
}
