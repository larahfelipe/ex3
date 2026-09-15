import {
  PortfolioMessages,
  type SortOrderTypes,
  TransactionTypes
} from '@/config';
import type { Position, Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class GetAllAssetsService {
  private static INSTANCE: GetAllAssetsService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly transactionRepository: TransactionRepository;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
    this.transactionRepository = transactionRepository;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository
  ) {
    if (!GetAllAssetsService.INSTANCE)
      GetAllAssetsService.INSTANCE = new GetAllAssetsService(
        assetRepository,
        portfolioRepository,
        transactionRepository
      );

    return GetAllAssetsService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    page,
    limit,
    sort
  }: GetAllAssetsService.DTO): Promise<GetAllAssetsService.Result> {
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { pagination, docs: assets } = await this.assetRepository.getAll({
      page,
      limit,
      sort,
      portfolioId: portfolioExists.id
    });

    const typeCounts = await this.transactionRepository.countByType({
      portfolioId: portfolioExists.id,
      instrumentIds: assets.map(({ instrumentId }) => instrumentId)
    });

    const countOf = (
      instrumentId: Transaction['instrumentId'],
      type: Transaction['type']
    ) =>
      typeCounts.find(
        (typeCount) =>
          typeCount.instrumentId === instrumentId && typeCount.type === type
      )?.count ?? 0;

    return {
      ...(sort && { sort: { field: 'investedValue', order: sort } }),
      pagination,
      assets: assets.map((asset) => ({
        ...asset,
        transactionCount: {
          buy: countOf(asset.instrumentId, TransactionTypes.BUY),
          sell: countOf(asset.instrumentId, TransactionTypes.SELL)
        }
      }))
    };
  }
}

namespace GetAllAssetsService {
  export type DTO = {
    userId: string;
    portfolioId: string;
    page?: number;
    limit?: number;
    sort?: (typeof SortOrderTypes)[keyof typeof SortOrderTypes];
  };
  export type TransactionCount = Record<'buy' | 'sell', number>;
  export type ListedAsset = Position &
    Record<'transactionCount', TransactionCount>;
  export type Result = {
    assets: Array<ListedAsset>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
    sort?: Record<'field' | 'order', string>;
  };
}
