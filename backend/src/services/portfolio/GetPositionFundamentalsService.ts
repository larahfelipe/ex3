import { AssetMessages } from '@/config';
import {
  describeFundamentals,
  fundamentalMetricsOf,
  type PositionFundamentals
} from '@/domain/Fundamentals';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import type { Portfolio } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetPositionFundamentalsService {
  private static INSTANCE: GetPositionFundamentalsService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly marketDataProvider: MarketDataProvider;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
    this.marketDataProvider = marketDataProvider;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider
  ) {
    if (!GetPositionFundamentalsService.INSTANCE)
      GetPositionFundamentalsService.INSTANCE =
        new GetPositionFundamentalsService(
          assetRepository,
          portfolioRepository,
          marketDataProvider
        );

    return GetPositionFundamentalsService.INSTANCE;
  }

  /** A class no metric reads is answered without asking the provider. */
  async execute({
    userId,
    portfolioId,
    symbol
  }: GetPositionFundamentalsService.DTO): Promise<GetPositionFundamentalsService.Result> {
    await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const [position] = await this.assetRepository.getPricedPositions({
      portfolioId,
      symbols: [symbol]
    });

    if (!position) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const metrics = fundamentalMetricsOf(position.type);

    if (metrics.length === 0) return { outcome: 'not-applicable' };

    const lookup = await this.marketDataProvider.getFundamentals(
      position,
      metrics
    );

    return lookup.outcome === 'reported'
      ? describeFundamentals(metrics, lookup.fundamentals, lookup.source)
      : lookup;
  }
}

namespace GetPositionFundamentalsService {
  export type DTO = Record<'userId' | 'symbol', string> &
    Record<'portfolioId', Portfolio['id']>;
  export type Result = PositionFundamentals;
}
