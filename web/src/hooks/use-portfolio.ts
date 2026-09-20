import { useCallback } from 'react';

import {
  keepPreviousData,
  skipToken,
  useQuery,
  useQueryClient,
  type QueryKey
} from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type {
  GetPortfolioAllocationResponseData,
  GetPortfolioOverviewResponseData,
  GetPortfolioPerformanceRequestParams,
  GetPortfolioPerformanceResponseData,
  GetPortfolioPositionResponseData,
  GetPortfolioPositionsRequestParams,
  GetPortfolioPositionsResponseData,
  PerformanceParams,
  PortfolioScopeParams,
  PositionListingParams
} from '@/app/api/v1/portfolio';
import type {
  GetPortfoliosRequestParams,
  GetPortfoliosResponseData,
  Portfolio
} from '@/app/api/v1/portfolios';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe, WithMessage } from '@/types';

/** Portfolios are listed in creation order, so this page holds the one the account was created with. */
const PRIMARY_PORTFOLIO_PAGE: GetPortfoliosRequestParams = {
  page: 1,
  limit: 1
};

export const requirePortfolio = (portfolio: Maybe<Portfolio>): Portfolio => {
  if (!portfolio) throw new Error('Missing portfolio');

  return portfolio;
};

export const useRefreshPortfolio = (portfolio: Maybe<Portfolio>) => {
  const queryClient = useQueryClient();
  const portfolioId = portfolio?.id;

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.portfolio(portfolioId)
      }),
    [queryClient, portfolioId]
  );
};

type PortfolioScopedQuery<Data> = {
  queryKey: QueryKey;
  portfolio: Maybe<Portfolio>;
  request: (portfolioId: string) => Promise<AxiosResponse<Data>>;
  keepsPreviousPage?: boolean;
};

export const usePortfolioScopedQuery = <Data>({
  queryKey,
  portfolio,
  request,
  keepsPreviousPage
}: PortfolioScopedQuery<Data>) =>
  useQuery<AxiosResponse<Data>, ApiProxyErrorData, Data>({
    queryKey,
    queryFn: portfolio ? () => request(portfolio.id) : skipToken,
    select: ({ data }) => data,
    ...(keepsPreviousPage && { placeholderData: keepPreviousData })
  });

export const useAnnouncePortfolioChange = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  return useCallback(
    async ({ data }: AxiosResponse<WithMessage>) => {
      toast.success(data.message);
      await refreshPortfolio();
    },
    [refreshPortfolio]
  );
};

export const usePrimaryPortfolio = () =>
  useQuery<
    AxiosResponse<GetPortfoliosResponseData>,
    ApiProxyErrorData,
    Maybe<Portfolio>
  >({
    queryKey: queryKeys.portfolios(PRIMARY_PORTFOLIO_PAGE),
    queryFn: () =>
      api
        .getInstance()
        .get('/v1/portfolios', { params: PRIMARY_PORTFOLIO_PAGE }),
    select: ({ data }) => data.portfolios.at(0)
  });

export const usePortfolioOverview = (portfolio: Maybe<Portfolio>) =>
  usePortfolioScopedQuery<GetPortfolioOverviewResponseData>({
    queryKey: queryKeys.portfolioOverview(portfolio?.id),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/portfolio/overview', {
        params: { portfolioId } satisfies PortfolioScopeParams
      })
  });

export const usePositions = (
  portfolio: Maybe<Portfolio>,
  listing: PositionListingParams
) =>
  usePortfolioScopedQuery<GetPortfolioPositionsResponseData>({
    queryKey: queryKeys.positions(portfolio?.id, listing),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/portfolio/positions', {
        params: {
          ...listing,
          portfolioId
        } satisfies GetPortfolioPositionsRequestParams
      }),
    keepsPreviousPage: true
  });

export const usePosition = (portfolio: Maybe<Portfolio>, symbol: string) =>
  usePortfolioScopedQuery<GetPortfolioPositionResponseData>({
    queryKey: queryKeys.position(portfolio?.id, symbol),
    portfolio,
    request: (portfolioId) =>
      api
        .getInstance()
        .get(`/v1/portfolio/positions/${encodeURIComponent(symbol)}`, {
          params: { portfolioId } satisfies PortfolioScopeParams
        })
  });

export const usePerformance = (
  portfolio: Maybe<Portfolio>,
  performance: PerformanceParams
) =>
  usePortfolioScopedQuery<GetPortfolioPerformanceResponseData>({
    queryKey: queryKeys.performance(portfolio?.id, performance),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/portfolio/performance', {
        params: {
          ...performance,
          portfolioId
        } satisfies GetPortfolioPerformanceRequestParams
      }),
    keepsPreviousPage: true
  });

export const useAllocation = (portfolio: Maybe<Portfolio>) =>
  usePortfolioScopedQuery<GetPortfolioAllocationResponseData>({
    queryKey: queryKeys.allocation(portfolio?.id),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/portfolio/allocation', {
        params: { portfolioId } satisfies PortfolioScopeParams
      })
  });
