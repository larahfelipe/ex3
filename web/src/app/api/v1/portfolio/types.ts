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

export type GetPortfolioAllocationResponseData = PortfolioAllocation;

export type PerformanceRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'MAX';

export type PerformancePoint = Record<'date', string> &
  Record<'value' | 'investedValue' | 'netContribution' | 'twr', DecimalString>;

export type PortfolioPerformance = WithBaseCurrency &
  Record<'from' | 'to', string> &
  Record<'series', Array<PerformancePoint>>;

export type GetPortfolioPerformanceRequestParams = PortfolioScopeParams &
  Record<'range', PerformanceRange>;

export type GetPortfolioPerformanceResponseData = PortfolioPerformance;
