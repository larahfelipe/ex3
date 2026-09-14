import { PortfolioMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  foreignCurrenciesOf,
  holdsUnits,
  type PortfolioOverview,
  summarizePortfolio
} from '@/domain/PortfolioValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

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
    const portfolio = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { baseCurrency } = portfolio;
    const positions = await this.assetRepository.getPricedPositions({
      portfolioId: portfolio.id
    });
    const heldPositions = positions.filter(holdsUnits);

    const [quotes, exchangeRates] = await Promise.all([
      this.marketDataProvider.getQuotes(heldPositions),
      this.marketDataProvider.getExchangeRates(
        foreignCurrenciesOf(heldPositions, baseCurrency),
        baseCurrency
      )
    ]);

    return summarizePortfolio({
      baseCurrency,
      positions,
      quotes,
      exchangeRates
    });
  }
}

namespace GetPortfolioOverviewService {
  export type DTO = {
    userId: string;
    portfolioId: string;
  };
  export type Result = PortfolioOverview;
}
