import type { MarketDataStatus } from '@/app/api/v1/portfolio';

export const isValuationIncomplete = ({
  missingQuotes,
  missingRates
}: MarketDataStatus) => missingQuotes.length > 0 || missingRates.length > 0;

export const isMarketDataDegraded = (marketData: MarketDataStatus) =>
  isValuationIncomplete(marketData) ||
  marketData.isFallback ||
  marketData.isStale;
