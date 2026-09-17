import { QueryClient } from '@tanstack/react-query';

import type {
  PerformanceParams,
  PositionListingParams
} from '@/app/api/v1/portfolio';
import type {
  GetPortfoliosRequestParams,
  Portfolio
} from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import type { Maybe } from '@/types';

export const QUERY_RETRY_LIMIT = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: QUERY_RETRY_LIMIT
    },
    mutations: {
      retry: 2
    }
  }
});

type PortfolioId = Maybe<Portfolio['id']>;

const portfolioScope = (portfolioId: PortfolioId) =>
  ['portfolio', portfolioId] as const;

export const queryKeys = {
  currentUser: () => ['user'] as const,
  portfolios: (requestedPage: GetPortfoliosRequestParams) =>
    ['portfolios', requestedPage] as const,
  portfolio: portfolioScope,
  portfolioOverview: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'overview'] as const,
  positions: (portfolioId: PortfolioId, listing: PositionListingParams) =>
    [...portfolioScope(portfolioId), 'positions', listing] as const,
  position: (portfolioId: PortfolioId, symbol: string) =>
    [...portfolioScope(portfolioId), 'position', symbol] as const,
  allocation: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'allocation'] as const,
  performance: (portfolioId: PortfolioId, params: PerformanceParams) =>
    [...portfolioScope(portfolioId), 'performance', params] as const,
  transactions: (portfolioId: PortfolioId, filters: TransactionFilters) =>
    [...portfolioScope(portfolioId), 'transactions', filters] as const
};
