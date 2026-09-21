import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  keepPreviousData,
  partialMatchKey,
  skipToken,
  useMutation,
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
  CreatePortfolioRequestPayload,
  CreatePortfolioResponseData,
  DeletePortfolioResponseData,
  GetPortfolioResponseData,
  GetPortfoliosRequestParams,
  GetPortfoliosResponseData,
  Portfolio,
  UpdatePortfolioRequestPayload,
  UpdatePortfolioResponseData
} from '@/app/api/v1/portfolios';
import { APP_STORAGE_KEYS } from '@/common/constants';
import api, {
  isNotFoundError,
  isValidationError,
  type ApiProxyErrorData
} from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe, WithMessage } from '@/types';

/** Portfolios are listed in creation order, so this page holds the one the account was created with. */
const PRIMARY_PORTFOLIO_PAGE: GetPortfoliosRequestParams = {
  page: 1,
  limit: 1
};

const activePortfolioSubscribers = new Set<VoidFunction>();

const readActivePortfolioId = (): Maybe<string> => {
  try {
    return localStorage.getItem(APP_STORAGE_KEYS.ActivePortfolio);
  } catch {
    return null;
  }
};

const subscribeToActivePortfolio = (onChange: VoidFunction) => {
  const onStorageChange = ({ key }: StorageEvent) => {
    if (key === null || key === APP_STORAGE_KEYS.ActivePortfolio) onChange();
  };

  activePortfolioSubscribers.add(onChange);
  window.addEventListener('storage', onStorageChange);

  return () => {
    activePortfolioSubscribers.delete(onChange);
    window.removeEventListener('storage', onStorageChange);
  };
};

export const selectActivePortfolio = (portfolioId: Maybe<string>) => {
  try {
    if (portfolioId) {
      localStorage.setItem(APP_STORAGE_KEYS.ActivePortfolio, portfolioId);
    } else {
      localStorage.removeItem(APP_STORAGE_KEYS.ActivePortfolio);
    }
  } catch {
    return false;
  }

  activePortfolioSubscribers.forEach((notify) => notify());

  return true;
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
    placeholderData: keepsPreviousPage
      ? (previousData, previousQuery) =>
          previousQuery &&
          partialMatchKey(
            previousQuery.queryKey,
            queryKeys.portfolio(portfolio?.id)
          )
            ? previousData
            : undefined
      : undefined
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

/**
 * The server snapshot is `undefined`, not the `null` of no stored choice, so no
 * portfolio is requested before the choice is read on the client.
 */
export const useActivePortfolio = () => {
  const activePortfolioId = useSyncExternalStore(
    subscribeToActivePortfolio,
    readActivePortfolioId,
    () => undefined
  );

  const chosenPortfolioQuery = useQuery<
    AxiosResponse<GetPortfolioResponseData>,
    ApiProxyErrorData,
    Maybe<Portfolio>
  >({
    queryKey: queryKeys.portfolioDetails(activePortfolioId),
    queryFn: activePortfolioId
      ? () =>
          api.getInstance().get('/v1/portfolio', {
            params: {
              portfolioId: activePortfolioId
            } satisfies PortfolioScopeParams
          })
      : skipToken,
    select: ({ data }) => data
  });

  const { error } = chosenPortfolioQuery;
  const isChoiceLost =
    error !== null && (isNotFoundError(error) || isValidationError(error));
  const isChoiceUsable = !!activePortfolioId && !isChoiceLost;

  const oldestPortfolioQuery = useQuery<
    AxiosResponse<GetPortfoliosResponseData>,
    ApiProxyErrorData,
    Maybe<Portfolio>
  >({
    queryKey: queryKeys.portfolioPage(PRIMARY_PORTFOLIO_PAGE),
    queryFn:
      activePortfolioId === null || isChoiceLost
        ? () =>
            api
              .getInstance()
              .get('/v1/portfolios', { params: PRIMARY_PORTFOLIO_PAGE })
        : skipToken,
    select: ({ data }) => data.portfolios.at(0)
  });

  useEffect(() => {
    if (isChoiceLost) selectActivePortfolio(null);
  }, [isChoiceLost]);

  return isChoiceUsable ? chosenPortfolioQuery : oldestPortfolioQuery;
};

export const usePortfolios = (requestedPage: GetPortfoliosRequestParams) =>
  useQuery<
    AxiosResponse<GetPortfoliosResponseData>,
    ApiProxyErrorData,
    GetPortfoliosResponseData
  >({
    queryKey: queryKeys.portfolioPage(requestedPage),
    queryFn: () =>
      api.getInstance().get('/v1/portfolios', { params: requestedPage }),
    select: ({ data }) => data,
    placeholderData: keepPreviousData
  });

const useAnnouncePortfoliosChange = () => {
  const queryClient = useQueryClient();

  return useCallback(
    async ({ data }: AxiosResponse<WithMessage>) => {
      toast.success(data.message);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.portfolios()
      });
    },
    [queryClient]
  );
};

export const useCreatePortfolio = () => {
  const announceChange = useAnnouncePortfoliosChange();

  return useMutation<
    AxiosResponse<CreatePortfolioResponseData>,
    ApiProxyErrorData,
    CreatePortfolioRequestPayload
  >({
    mutationFn: (payload) =>
      api
        .getInstance()
        .post(
          '/v1/portfolios/create',
          payload satisfies CreatePortfolioRequestPayload
        ),
    onSuccess: announceChange
  });
};

export const useUpdatePortfolio = () => {
  const queryClient = useQueryClient();
  const announceChange = useAnnouncePortfoliosChange();

  return useMutation<
    AxiosResponse<UpdatePortfolioResponseData>,
    ApiProxyErrorData,
    UpdatePortfolioRequestPayload
  >({
    mutationFn: (payload) =>
      api
        .getInstance()
        .patch(
          '/v1/portfolio',
          payload satisfies UpdatePortfolioRequestPayload
        ),
    onSuccess: async (response, { portfolioId }) => {
      await Promise.all([
        announceChange(response),
        queryClient.invalidateQueries({
          queryKey: queryKeys.portfolio(portfolioId)
        })
      ]);
    }
  });
};

export const useDeletePortfolio = () => {
  const queryClient = useQueryClient();
  const announceChange = useAnnouncePortfoliosChange();

  return useMutation<
    AxiosResponse<DeletePortfolioResponseData>,
    ApiProxyErrorData,
    PortfolioScopeParams
  >({
    mutationFn: (params) =>
      api.getInstance().delete('/v1/portfolio', {
        params: params satisfies PortfolioScopeParams
      }),
    onSuccess: async (response, { portfolioId }) => {
      if (readActivePortfolioId() === portfolioId) selectActivePortfolio(null);

      queryClient.removeQueries({ queryKey: queryKeys.portfolio(portfolioId) });
      queryClient.removeQueries({
        queryKey: queryKeys.portfolioDetails(portfolioId)
      });

      await announceChange(response);
    }
  });
};

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
