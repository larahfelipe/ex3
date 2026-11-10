import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import {
  describeMarketData,
  summarizePortfolio,
  type MarketDataStatus,
  type PortfolioOverview
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';
import { log, LogSeverities, type LogSink } from '@/infra/observability';

import { quoteHoldings, readPortfolioHoldings } from './QuotedHoldings';

/**
 * A total the API cannot calculate is worth a line of its own: the provider
 * records an outage once, while this names what each affected portfolio is
 * left without, a symbol the source does not know or a pair it has no rate for
 * included. Only codes are written, nothing of the user's holdings.
 */
export const logValuationGaps = (
  logEntry: LogSink,
  portfolioId: string,
  heldPositionCount: number,
  { valuedPositionCount, missingQuotes, missingRates }: MarketDataStatus
) => {
  if (missingQuotes.length === 0 && missingRates.length === 0) return;

  logEntry({
    severity: LogSeverities.WARNING,
    event: 'valuation_incomplete',
    portfolioId,
    heldPositionCount,
    valuedPositionCount,
    missingQuotes,
    missingRates
  });
};

export class GetPortfolioOverviewService {
  private static INSTANCE: GetPortfolioOverviewService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly marketDataProvider: MarketDataProvider;
  private readonly now: () => Date;
  private readonly logEntry: LogSink;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date,
    logEntry: LogSink
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
    this.marketDataProvider = marketDataProvider;
    this.now = now;
    this.logEntry = logEntry;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date = () => new Date(),
    logEntry: LogSink = log
  ) {
    if (!GetPortfolioOverviewService.INSTANCE)
      GetPortfolioOverviewService.INSTANCE = new GetPortfolioOverviewService(
        assetRepository,
        portfolioRepository,
        marketDataProvider,
        now,
        logEntry
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

    const quoted = await quoteHoldings(this.marketDataProvider, holdings);
    const overview = summarizePortfolio(quoted);
    const marketData = describeMarketData(
      quoted,
      overview.quotedAt,
      this.now()
    );

    logValuationGaps(
      this.logEntry,
      portfolioId,
      overview.heldPositionCount,
      marketData
    );

    return { ...overview, marketData };
  }
}

namespace GetPortfolioOverviewService {
  export type DTO = {
    userId: string;
    portfolioId: string;
  };
  export type Result = PortfolioOverview &
    Record<'marketData', MarketDataStatus>;
}
