import { PortfolioMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  allocatePortfolio,
  foreignCurrenciesOf,
  holdsUnits,
  type PortfolioAllocation
} from '@/domain/PortfolioValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

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

    return allocatePortfolio({
      baseCurrency,
      positions,
      quotes,
      exchangeRates
    });
  }
}

namespace GetPortfolioAllocationService {
  export type DTO = {
    userId: string;
    portfolioId: string;
  };
  export type Result = PortfolioAllocation;
}
