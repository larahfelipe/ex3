import { AssetMessages, PortfolioMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  describePosition,
  foreignCurrenciesOf,
  holdsUnits,
  type PositionDetail
} from '@/domain/PortfolioValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

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
    const portfolio = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { baseCurrency } = portfolio;
    const positions = await this.assetRepository.getPricedPositions({
      portfolioId: portfolio.id
    });
    const position = positions.find((held) => held.symbol === symbol);

    if (!position) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const valuedPositions = positions.filter(
      (held) => holdsUnits(held) || held === position
    );

    const [quotes, exchangeRates] = await Promise.all([
      this.marketDataProvider.getQuotes(valuedPositions),
      this.marketDataProvider.getExchangeRates(
        foreignCurrenciesOf(valuedPositions, baseCurrency),
        baseCurrency
      )
    ]);

    return describePosition(
      { baseCurrency, positions, quotes, exchangeRates },
      position
    );
  }
}

namespace GetPortfolioPositionService {
  export type DTO = Record<'userId' | 'portfolioId' | 'symbol', string>;
  export type Result = PositionDetail;
}
