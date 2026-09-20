import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  type PortfolioOverview,
  summarizePortfolio
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { quoteHoldings, readPortfolioHoldings } from './QuotedHoldings';

export class GetPortfolioOverviewService {
  private static INSTANCE: GetPortfolioOverviewService;
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
    if (!GetPortfolioOverviewService.INSTANCE)
      GetPortfolioOverviewService.INSTANCE = new GetPortfolioOverviewService(
        assetRepository,
        portfolioRepository,
        marketDataProvider
      );

    return GetPortfolioOverviewService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId
  }: GetPortfolioOverviewService.DTO): Promise<GetPortfolioOverviewService.Result> {
    const holdings = await readPortfolioHoldings(
      this.assetRepository,
      this.portfolioRepository,
      { userId, portfolioId }
    );

    return summarizePortfolio(
      await quoteHoldings(this.marketDataProvider, holdings)
    );
  }
}

namespace GetPortfolioOverviewService {
  export type DTO = {
    userId: string;
    portfolioId: string;
  };
  export type Result = PortfolioOverview;
}
