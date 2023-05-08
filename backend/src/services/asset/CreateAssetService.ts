import { AssetMessages, PortfolioMessages } from '@/config';
import type { Asset } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class CreateAssetService {
  private static INSTANCE: CreateAssetService;
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
    if (!CreateAssetService.INSTANCE)
      CreateAssetService.INSTANCE = new CreateAssetService(
        assetRepository,
        portfolioRepository
      );

    return CreateAssetService.INSTANCE;
  }

  async execute({ userId, symbol }: CreateAssetService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetAlreadyExists = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolioExists.id
    });

    if (assetAlreadyExists)
      throw new BadRequestError(AssetMessages.ALREADY_EXISTS);

    const newAsset = await this.assetRepository.add({
      symbol,
      portfolioId: portfolioExists.id
    });

    const res: CreateAssetService.Result = {
      asset: newAsset,
      message: AssetMessages.CREATED
    };

    return res;
  }
}

namespace CreateAssetService {
  export type DTO = Pick<Asset, 'symbol'> & {
    userId: string;
  };
  export type Result = {
    asset: Omit<Asset, 'transactions'>;
    message: string;
  };
}
