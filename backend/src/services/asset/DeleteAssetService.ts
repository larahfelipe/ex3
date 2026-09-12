import { AssetMessages, PortfolioMessages } from '@/config';
import type { Asset } from '@/domain/models';
import { NotFoundError } from '@/errors';
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

  async execute({
    userId,
    symbol
  }: DeleteAssetService.DTO): Promise<DeleteAssetService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    await this.assetRepository.delete({
      symbol,
      portfolioId: portfolioExists.id
    });

    return {
      message: AssetMessages.DELETED
    };
  }
}

namespace DeleteAssetService {
  export type DTO = Pick<Asset, 'symbol'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
