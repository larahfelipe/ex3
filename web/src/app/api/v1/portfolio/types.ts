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
  >;

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

export type GetPortfolioPositionsRequestParams = PortfolioScopeParams &
  PageParams;

export type GetPortfolioPositionsResponseData = Page<PortfolioPosition>;

export type GetPortfolioAllocationResponseData = PortfolioAllocation;
