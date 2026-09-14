import { skipToken, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import type {
  GetPortfolioAllocationResponseData,
  GetPortfolioOverviewResponseData,
  GetPortfolioPositionsRequestParams,
  GetPortfolioPositionsResponseData,
  PortfolioScopeParams
} from '@/app/api/v1/portfolio';
import type {
  GetPortfoliosRequestParams,
  GetPortfoliosResponseData,
  Portfolio
} from '@/app/api/v1/portfolios';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import type { Maybe, PageParams } from '@/types';

const PORTFOLIOS_STALE_TIME_MS = 60_000;

/** Portfolios are listed in creation order, so this page holds the one the account was created with. */
const PRIMARY_PORTFOLIO_PAGE: GetPortfoliosRequestParams = {
  page: 1,
  limit: 1
};

export const requirePortfolio = (portfolio: Maybe<Portfolio>): Portfolio => {
  if (!portfolio) throw new Error('Missing portfolio');

  return portfolio;
};

export const usePrimaryPortfolio = () =>
  useQuery<
    AxiosResponse<GetPortfoliosResponseData>,
    ApiProxyErrorData,
    Maybe<Portfolio>
  >({
    queryKey: ['portfolios', PRIMARY_PORTFOLIO_PAGE],
    queryFn: () =>
      api
        .getInstance()
        .get('/v1/portfolios', { params: PRIMARY_PORTFOLIO_PAGE }),
    select: ({ data }) => data.portfolios.at(0),
    staleTime: PORTFOLIOS_STALE_TIME_MS
  });

export const usePortfolioOverview = (portfolio: Maybe<Portfolio>) =>
  useQuery<
    AxiosResponse<GetPortfolioOverviewResponseData>,
    ApiProxyErrorData,
    GetPortfolioOverviewResponseData
  >({
    queryKey: ['portfolio-overview', portfolio?.id],
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/portfolio/overview', {
            params: { portfolioId: portfolio.id } satisfies PortfolioScopeParams
          })
      : skipToken,
    select: ({ data }) => data
  });

export const usePositions = (
  portfolio: Maybe<Portfolio>,
  requestedPage: PageParams
) =>
  useQuery<
    AxiosResponse<GetPortfolioPositionsResponseData>,
    ApiProxyErrorData,
    GetPortfolioPositionsResponseData
  >({
    queryKey: ['portfolio-positions', portfolio?.id, requestedPage],
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/portfolio/positions', {
            params: {
              ...requestedPage,
              portfolioId: portfolio.id
            } satisfies GetPortfolioPositionsRequestParams
          })
      : skipToken,
    select: ({ data }) => data
  });

export const useAllocation = (portfolio: Maybe<Portfolio>) =>
  useQuery<
    AxiosResponse<GetPortfolioAllocationResponseData>,
    ApiProxyErrorData,
    GetPortfolioAllocationResponseData
  >({
    queryKey: ['portfolio-allocation', portfolio?.id],
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/portfolio/allocation', {
            params: { portfolioId: portfolio.id } satisfies PortfolioScopeParams
          })
      : skipToken,
    select: ({ data }) => data
  });
