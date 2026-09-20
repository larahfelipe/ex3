import { SortOrderTypes } from '@/config';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  holdsUnits,
  matchesPositionFilter,
  type PortfolioPosition,
  type PositionFilter,
  type PositionSortField,
  PositionSortFields,
  type SortOrder,
  sortPositionsBy,
  valuePositionsInBaseCurrency
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Page } from '@/interfaces';

import { quoteHoldings, readPortfolioHoldings } from './QuotedHoldings';

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
   * Positions come in symbol order, and a sort by a value keeps it for ties.
   * Allocation is a fraction of the whole portfolio, so every position with
   * units is quoted, not only those listed, and a sort by a value quotes every
   * position the filter matches, since the page is cut after valuing them.
   */
  async execute({
    userId,
    portfolioId,
    page,
    pageSize,
    sortBy,
    sortOrder,
    ...filter
  }: GetPortfolioPositionsService.DTO): Promise<GetPortfolioPositionsService.Result> {
    const holdings = await readPortfolioHoldings(
      this.assetRepository,
      this.portfolioRepository,
      { userId, portfolioId }
    );
    const { positions } = holdings;
    const matchingPositions = positions.filter(matchesPositionFilter(filter));
    const pageOf = <Item>(items: ReadonlyArray<Item>) =>
      items.slice((page - 1) * pageSize, page * pageSize);
    const listedPositions =
      sortBy === PositionSortFields.SYMBOL
        ? pageOf(
            sortOrder === SortOrderTypes.DESCENDENT
              ? matchingPositions.toReversed()
              : matchingPositions
          )
        : matchingPositions;
    const valuedPositions = positions.filter(
      (position) => holdsUnits(position) || listedPositions.includes(position)
    );

    const listedValues = valuePositionsInBaseCurrency(
      await quoteHoldings(this.marketDataProvider, holdings, valuedPositions),
      listedPositions
    );

    return {
      items:
        sortBy === PositionSortFields.SYMBOL
          ? listedValues
          : pageOf(sortPositionsBy(listedValues, sortBy, sortOrder)),
      page,
      pageSize,
      total: matchingPositions.length,
      totalPages: Math.ceil(matchingPositions.length / pageSize)
    };
  }
}

namespace GetPortfolioPositionsService {
  export type DTO = {
    userId: string;
    portfolioId: string;
    page: number;
    pageSize: number;
    sortBy: PositionSortField;
    sortOrder: SortOrder;
  } & PositionFilter;
  export type Result = Page<PortfolioPosition>;
}
