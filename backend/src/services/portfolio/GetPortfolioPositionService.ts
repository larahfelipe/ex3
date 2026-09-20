import { AssetMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  describePosition,
  holdsUnits,
  type PositionDetail
} from '@/domain/PortfolioValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { quoteHoldings, readPortfolioHoldings } from './QuotedHoldings';

export class GetPortfolioPositionService {
  private static INSTANCE: GetPortfolioPositionService;
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
    if (!GetPortfolioPositionService.INSTANCE)
      GetPortfolioPositionService.INSTANCE = new GetPortfolioPositionService(
        assetRepository,
        portfolioRepository,
        marketDataProvider
      );

    return GetPortfolioPositionService.INSTANCE;
  }

  /**
   * Allocation is a fraction of the whole portfolio, so every position with
   * units is quoted besides this one.
   */
  async execute({
    userId,
    portfolioId,
    symbol
  }: GetPortfolioPositionService.DTO): Promise<GetPortfolioPositionService.Result> {
    const holdings = await readPortfolioHoldings(
      this.assetRepository,
      this.portfolioRepository,
      { userId, portfolioId }
    );
    const position = holdings.positions.find((held) => held.symbol === symbol);

    if (!position) throw new NotFoundError(AssetMessages.NOT_FOUND);

    return describePosition(
      await quoteHoldings(
        this.marketDataProvider,
        holdings,
        holdings.positions.filter(
          (held) => holdsUnits(held) || held === position
        )
      ),
      position
    );
  }
}

namespace GetPortfolioPositionService {
  export type DTO = Record<'userId' | 'portfolioId' | 'symbol', string>;
  export type Result = PositionDetail;
}
