import type { DecimalString, Maybe, Page, PageParams } from '@/types';

import type { Portfolio } from '../portfolios';

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

export type GetPortfolioOverviewResponseData = PortfolioOverview;

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

export type PortfolioPerformance = WithBaseCurrency &
  Record<'from' | 'to', string> &
  Record<'series', Array<PerformancePoint>>;

export type PerformanceParams = Record<'range', PerformanceRange> &
  Partial<Record<'symbol', string>>;

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
