import { AssetMessages, PortfolioMessages } from '@/config';
import type { Asset } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class GetAssetService {
  private static INSTANCE: GetAssetService;
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
    if (!GetAssetService.INSTANCE)
      GetAssetService.INSTANCE = new GetAssetService(
        assetRepository,
        portfolioRepository
      );

    return GetAssetService.INSTANCE;
  }

  async execute({
    userId,
    symbol
  }: GetAssetService.DTO): Promise<GetAssetService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const asset = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolioExists.id
    });

    if (!asset) throw new NotFoundError(AssetMessages.NOT_FOUND);

    return { ...asset };
  }
}

namespace GetAssetService {
  export type DTO = Pick<Asset, 'symbol'> & Record<'userId', string>;
  export type Result = Omit<Asset, 'transactions'>;
}
