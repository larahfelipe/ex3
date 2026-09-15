import { QueryClient } from '@tanstack/react-query';

import type { GetAssetRequestParams } from '@/app/api/v1/assets';
import type {
  GetPortfoliosRequestParams,
  Portfolio
} from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import type { Maybe, PageParams } from '@/types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2
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
  positions: (portfolioId: PortfolioId, requestedPage: PageParams) =>
    [...portfolioScope(portfolioId), 'positions', requestedPage] as const,
  allocation: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'allocation'] as const,
  assets: (
    portfolioId: PortfolioId,
    requestedPage: Pick<GetAssetRequestParams, 'page' | 'limit'>
  ) => [...portfolioScope(portfolioId), 'assets', requestedPage] as const,
  assetValuations: (portfolioId: PortfolioId, symbols: ReadonlyArray<string>) =>
    [...portfolioScope(portfolioId), 'asset-valuations', symbols] as const,
  transactions: (portfolioId: PortfolioId, filters: TransactionFilters) =>
    [...portfolioScope(portfolioId), 'transactions', filters] as const
};
