import { PortfolioMessages } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import type { Position } from '@/domain/models';
import {
  type PositionValuation,
  valuePosition
} from '@/domain/PositionValuation';
import { NotFoundError } from '@/errors';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

export class GetAssetValuationsService {
  private static INSTANCE: GetAssetValuationsService;
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
    if (!GetAssetValuationsService.INSTANCE)
      GetAssetValuationsService.INSTANCE = new GetAssetValuationsService(
        assetRepository,
        portfolioRepository,
        marketDataProvider
      );

    return GetAssetValuationsService.INSTANCE;
  }

  /** Symbols the portfolio does not hold are left out of the result. */
  async execute({
    userId,
    portfolioId,
    symbols
  }: GetAssetValuationsService.DTO): Promise<GetAssetValuationsService.Result> {
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const positions = await this.assetRepository.getPricedPositions({
      portfolioId: portfolioExists.id,
      symbols
    });
    const quotes = await this.marketDataProvider.getQuotes(positions);

    return {
      valuations: positions.map((position) => ({
        symbol: position.symbol,
        ...valuePosition(
          position,
          quotes.get(position.symbol) ?? { outcome: 'unavailable' }
        )
      }))
    };
  }
}

namespace GetAssetValuationsService {
  export type DTO = {
    userId: string;
    portfolioId: string;
    symbols: Array<Position['symbol']>;
  };
  export type Result = {
    valuations: Array<Pick<Position, 'symbol'> & PositionValuation>;
  };
}
