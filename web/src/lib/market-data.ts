import type { MarketDataStatus } from '@/app/api/v1/portfolio';

/** Some held position is left out of the totals, for want of its price or of a rate to the base currency. */
export const isValuationIncomplete = ({
  missingQuotes,
  missingRates
}: MarketDataStatus) => missingQuotes.length > 0 || missingRates.length > 0;

/**
 * The totals rest on less than every position priced from a recent answer of
 * the source: some price or rate is missing, is the last one received before
 * the source failed, or is older than the API's freshness threshold.
 */
export const isMarketDataDegraded = (marketData: MarketDataStatus) =>
  isValuationIncomplete(marketData) ||
  marketData.isFallback ||
  marketData.isStale;
