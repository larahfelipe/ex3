import { PortfolioMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  foreignCurrenciesOf,
  holdsUnits,
  type PortfolioPosition,
  valuePositionsInBaseCurrency
} from '@/domain/PortfolioValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Page } from '@/interfaces';

export class GetPortfolioPositionsService {
  private static INSTANCE: GetPortfolioPositionsService;
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
    if (!GetPortfolioPositionsService.INSTANCE)
      GetPortfolioPositionsService.INSTANCE = new GetPortfolioPositionsService(
        assetRepository,
        portfolioRepository,
        marketDataProvider
      );

    return GetPortfolioPositionsService.INSTANCE;
  }

  /**
   * Positions are listed in symbol order. Allocation is a fraction of the whole
   * portfolio, so every position with units is quoted, not only those listed.
   */
  async execute({
    userId,
    portfolioId,
    page,
    pageSize
  }: GetPortfolioPositionsService.DTO): Promise<GetPortfolioPositionsService.Result> {
    const portfolio = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { baseCurrency } = portfolio;
    const positions = await this.assetRepository.getPricedPositions({
      portfolioId: portfolio.id
    });
    const listedPositions = positions.slice(
      (page - 1) * pageSize,
      page * pageSize
    );
    const valuedPositions = positions.filter(
      (position) => holdsUnits(position) || listedPositions.includes(position)
    );

    const [quotes, exchangeRates] = await Promise.all([
      this.marketDataProvider.getQuotes(valuedPositions),
      this.marketDataProvider.getExchangeRates(
        foreignCurrenciesOf(valuedPositions, baseCurrency),
        baseCurrency
      )
    ]);

    return {
      items: valuePositionsInBaseCurrency(
        { baseCurrency, positions, quotes, exchangeRates },
        listedPositions
      ),
      page,
      pageSize,
      total: positions.length,
      totalPages: Math.ceil(positions.length / pageSize)
    };
  }
}

namespace GetPortfolioPositionsService {
  export type DTO = {
    userId: string;
    portfolioId: string;
    page: number;
    pageSize: number;
  };
  export type Result = Page<PortfolioPosition>;
}
