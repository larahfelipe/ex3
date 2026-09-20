import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  allocatePortfolio,
  type PortfolioAllocation
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { quoteHoldings, readPortfolioHoldings } from './QuotedHoldings';

export class GetPortfolioAllocationService {
  private static INSTANCE: GetPortfolioAllocationService;
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
    if (!GetPortfolioAllocationService.INSTANCE)
      GetPortfolioAllocationService.INSTANCE =
        new GetPortfolioAllocationService(
          assetRepository,
          portfolioRepository,
          marketDataProvider
        );

    return GetPortfolioAllocationService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId
  }: GetPortfolioAllocationService.DTO): Promise<GetPortfolioAllocationService.Result> {
    const holdings = await readPortfolioHoldings(
      this.assetRepository,
      this.portfolioRepository,
      { userId, portfolioId }
    );

    return allocatePortfolio(
      await quoteHoldings(this.marketDataProvider, holdings)
    );
  }
}

namespace GetPortfolioAllocationService {
  export type DTO = {
    userId: string;
    portfolioId: string;
  };
  export type Result = PortfolioAllocation;
}
