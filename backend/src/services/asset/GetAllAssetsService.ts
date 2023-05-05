import { PortfolioMessages } from '@/constants';
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

  async execute({ userId, userIsStaff }: GetAllAssetsService.DTO) {
    let allAssets = [];

    if (!userIsStaff) {
      const portfolioExists = await this.portfolioRepository.getByUserId(
        userId
      );

      if (!portfolioExists)
        throw new NotFoundError(PortfolioMessages.NOT_FOUND);

      allAssets = await this.assetRepository.getAllByPortfolioId(
        portfolioExists.id
      );
    } else {
      allAssets = await this.assetRepository.getAll();
    }

    const res: GetAllAssetsService.Result = {
      assets: allAssets as Array<Asset>
    };

    return res;
  }
}

namespace GetAllAssetsService {
  export type DTO = {
    userId: string;
    userIsStaff: boolean;
  };
  export type Result = Record<'assets', Array<Asset>>;
}
