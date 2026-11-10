import type { DecimalString, Maybe, Page, PageParams } from '@/types';

import type { Portfolio } from '../portfolios';
import type { TransactionType } from '../transactions';

export type InstrumentType =
  | 'STOCK'
  | 'ETF'
  | 'FUND'
  | 'REIT'
  | 'CRYPTO'
  | 'BOND'
  | 'TREASURY'
  | 'CASH'
  | 'OTHER';

export type PortfolioScopeParams = Record<'portfolioId', Portfolio['id']>;

type WithBaseCurrency = Pick<Portfolio, 'baseCurrency'>;

export type PortfolioOverview = WithBaseCurrency &
  Record<'heldPositionCount', number> &
  Partial<
    Record<
      | 'totalValue'
      | 'investedValue'
      | 'profitLoss'
      | 'profitLossPercent'
      | 'dayChange'
      | 'dayChangePercent',
      DecimalString
    >
  > &
  Partial<Record<'quotedAt', string>>;

/** Why a price or a rate is missing: the source is down, or it does not know the symbol or the pair. */
export type MarketDataGapReason = 'unavailable' | 'not-found';

type MarketDataGap = Record<'reason', MarketDataGapReason>;

/** What the overview's value was built from: what is left out of it and how fresh the rest is. */
export type MarketDataStatus = Record<'valuedPositionCount', number> &
  Record<'missingQuotes', Array<Record<'symbol', string> & MarketDataGap>> &
  Record<'missingRates', Array<Record<'currency', string> & MarketDataGap>> &
  Record<'isFallback' | 'isStale', boolean>;

export type PortfolioPosition = WithBaseCurrency &
  Record<'symbol' | 'name', string> &
  Record<'quantity', DecimalString> &
  Partial<
    Record<
      | 'averageCost'
      | 'marketPrice'
      | 'marketValue'
      | 'allocation'
      | 'profitLoss'
      | 'profitLossPercent',
      DecimalString
    >
  >;

type AllocationShare = Pick<PortfolioPosition, 'marketValue' | 'allocation'>;

export type PortfolioAllocation = WithBaseCurrency &
  Pick<PortfolioOverview, 'totalValue'> & {
    byAsset: Array<
      Pick<PortfolioPosition, 'symbol' | 'name'> & AllocationShare
    >;
    byType: Array<Record<'type', InstrumentType> & AllocationShare>;
    bySector: Array<Record<'sector', Maybe<string>> & AllocationShare>;
    byCurrency: Array<Record<'currency', Maybe<string>> & AllocationShare>;
  };

export type GetPortfolioOverviewResponseData = PortfolioOverview &
  Record<'marketData', MarketDataStatus>;

export type PositionSortField = keyof Pick<
  PortfolioPosition,
  | 'symbol'
  | 'quantity'
  | 'averageCost'
  | 'marketPrice'
  | 'marketValue'
  | 'allocation'
  | 'profitLoss'
  | 'profitLossPercent'
>;

export type SortOrder = 'asc' | 'desc';

export type PositionStatus = 'open' | 'closed';

export type PositionListingParams = PageParams &
  Partial<{
    sortBy: PositionSortField;
    sortOrder: SortOrder;
    search: string;
    type: InstrumentType;
    status: PositionStatus;
  }>;

export type GetPortfolioPositionsRequestParams = PortfolioScopeParams &
  PositionListingParams;

export type GetPortfolioPositionsResponseData = Page<PortfolioPosition>;

export type PositionQuote = Record<'price', DecimalString> &
  Record<'currency' | 'timestamp', string> &
  Partial<
    Record<'previousClose' | 'dayChange' | 'dayChangePercent', DecimalString>
  >;

export type PositionDetail = PortfolioPosition &
  Record<'type', InstrumentType> &
  Record<'market' | 'currency' | 'sector', Maybe<string>> &
  Partial<Record<'quote', PositionQuote>>;

export type GetPortfolioPositionResponseData = PositionDetail;

export type GetPortfolioAllocationResponseData = PortfolioAllocation;

export type PerformanceRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'MAX';

export type PerformancePoint = Record<'date', string> &
  Record<'value' | 'investedValue' | 'netContribution' | 'twr', DecimalString>;

/** The period from its first point to its last; the percentage is left out when the first value is zero. */
export type PerformanceSummary = Record<
  'valueChange' | 'netContribution' | 'twr',
  DecimalString
> &
  Partial<Record<'valueChangePercent', DecimalString>>;

/**
 * A day's price return in the base currency since the portfolio's first point.
 * A day of the portfolio without a close or a rate near it has no point here.
 */
export type BenchmarkPoint = Record<'date', string> &
  Record<'close' | 'twr', DecimalString>;

export type PerformanceBenchmark = Record<'symbol' | 'name', string> &
  Record<'currency', Maybe<string>> &
  Record<'series', Array<BenchmarkPoint>>;

export type PortfolioPerformance = WithBaseCurrency &
  Record<'from' | 'to', string> &
  Record<'series', Array<PerformancePoint>> &
  Partial<Record<'summary', PerformanceSummary>> &
  Partial<Record<'benchmark', PerformanceBenchmark>>;

export type PerformanceParams = Record<'range', PerformanceRange> &
  Partial<Record<'symbol' | 'benchmark', string>>;

export type GetPortfolioPerformanceRequestParams = PortfolioScopeParams &
  PerformanceParams;

export type GetPortfolioPerformanceResponseData = PortfolioPerformance;

export type PriceChangeRange = Extract<
  PerformanceRange,
  '1M' | '3M' | '6M' | 'YTD' | '1Y'
>;

/** A window's change is read from its opening close, so both come or neither does. */
export type PriceChange = Record<'range', PriceChangeRange> &
  (
    | Partial<Record<'change' | 'openedOn', never>>
    | (Record<'change', DecimalString> & Record<'openedOn', string>)
  );

export type PriceClose = Record<'close', DecimalString> &
  Record<'closedOn', string>;

export type PriceIndicators = Record<'currency' | 'closedOn', string> &
  Record<'close' | 'yearLow' | 'yearHigh', DecimalString> &
  Record<'changes', Array<PriceChange>> &
  Record<'closes', Array<PriceClose>>;

export type ReturnIndicators = Record<'currency' | 'since', string> &
  Record<'realizedProfitLoss' | 'income' | 'trailingIncome', DecimalString> &
  Partial<Record<'yieldOnCost', DecimalString>>;

export type PositionIndicators = Partial<{
  prices: PriceIndicators;
  returns: ReturnIndicators;
}>;

export type GetPositionIndicatorsResponseData = PositionIndicators;

export type IncomeType = Extract<
  TransactionType,
  'DIVIDEND' | 'JCP' | 'INTEREST'
>;

/** Net of fees and taxes: all that was recorded, and what was executed since `trailingFrom`. */
export type IncomeTotals = Record<'total' | 'trailingTotal', DecimalString>;

export type CurrencyIncome = Record<'currency', string> &
  IncomeTotals &
  Record<'byType', Array<Record<'type', IncomeType> & IncomeTotals>>;

/** Each currency apart and unconverted, the base currency first; one without income is left out. */
export type PortfolioIncome = Record<'trailingFrom', string> &
  Record<'byCurrency', Array<CurrencyIncome>>;

export type GetPortfolioIncomeResponseData = PortfolioIncome;

/** A multiple, as `12.5` for 12.5 times, or a share of one, as `0.12` for 12%. */
export type FundamentalRatio =
  | 'priceToEarnings'
  | 'dividendYield'
  | 'returnOnEquity'
  | 'profitMargin'
  | 'debtToEquity'
  | 'revenueGrowth'
  | 'earningsGrowth';

/** A figure without a value is one the source does not report for the instrument. */
export type FundamentalFigure =
  | (Record<'metric', FundamentalRatio> &
      Partial<Record<'value', DecimalString>>)
  | (Record<'metric', 'freeCashFlow'> &
      (
        | Partial<Record<'value' | 'currency', never>>
        | (Record<'value', DecimalString> & Record<'currency', string>)
      ));

export type ReportedFundamentals = Record<'outcome', 'reported'> &
  Record<'source', string> &
  Record<'figures', Array<FundamentalFigure>>;

export type PositionFundamentals =
  | Record<'outcome', 'not-applicable' | 'not-found' | 'unavailable'>
  | ReportedFundamentals;

export type GetPositionFundamentalsResponseData = PositionFundamentals;
