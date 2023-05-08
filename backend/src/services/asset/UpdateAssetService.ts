import { AssetMessages, PortfolioMessages } from '@/config';
import { BadRequestError, NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class UpdateAssetService {
  private static INSTANCE: UpdateAssetService;
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
    if (!UpdateAssetService.INSTANCE)
      UpdateAssetService.INSTANCE = new UpdateAssetService(
        assetRepository,
        portfolioRepository
      );

    return UpdateAssetService.INSTANCE;
  }

  async execute({ userId, oldSymbol, newSymbol }: UpdateAssetService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol: oldSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new BadRequestError(AssetMessages.NOT_FOUND);

    const assetAlreadyExists = await this.assetRepository.getBySymbol({
      symbol: newSymbol,
      portfolioId: portfolioExists.id
    });

    if (assetAlreadyExists)
      throw new BadRequestError(AssetMessages.ALREADY_EXISTS);

    await this.assetRepository.update({
      oldSymbol,
      newSymbol,
      portfolioId: portfolioExists.id
    });

    const res: UpdateAssetService.Result = {
      message: AssetMessages.UPDATED
    };

    return res;
  }
}

namespace UpdateAssetService {
  export type DTO = {
    oldSymbol: string;
    newSymbol: string;
    userId: string;
  };
  export type Result = {
    message: string;
  };
}
