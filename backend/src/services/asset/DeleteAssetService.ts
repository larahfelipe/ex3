import { AssetMessages, PortfolioMessages } from '@/config';
import type { Asset } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class DeleteAssetService {
  private static INSTANCE: DeleteAssetService;
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
    if (!DeleteAssetService.INSTANCE)
      DeleteAssetService.INSTANCE = new DeleteAssetService(
        assetRepository,
        portfolioRepository
      );

    return DeleteAssetService.INSTANCE;
  }

  async execute({ userId, symbol }: DeleteAssetService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new BadRequestError(AssetMessages.NOT_FOUND);

    await this.assetRepository.delete({
      symbol,
      portfolioId: portfolioExists.id
    });

    const res: DeleteAssetService.Result = {
      message: AssetMessages.DELETED
    };

    return res;
  }
}

namespace DeleteAssetService {
  export type DTO = Pick<Asset, 'symbol'> & {
    userId: string;
  };
  export type Result = {
    message: string;
  };
}
