import { AssetMessages } from '@/config';
import type { Position } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

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
    portfolioId,
    symbol
  }: DeleteAssetService.DTO): Promise<DeleteAssetService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const assetExists = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolio.id
    });

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    await this.assetRepository.delete({
      instrumentId: assetExists.instrumentId,
      portfolioId: portfolio.id
    });

    return {
      message: AssetMessages.DELETED
    };
  }
}

namespace DeleteAssetService {
  export type DTO = Pick<Position, 'symbol' | 'portfolioId'> &
    Record<'userId', string>;
  export type Result = Record<'message', string>;
}
