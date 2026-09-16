import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type {
  AssetValuation,
  CreateAssetRequestPayload,
  CreateAssetResponseData,
  DeleteAssetRequestPayload,
  DeleteAssetResponseData,
  GetAssetRequestParams,
  GetAssetResponseData,
  GetAssetValuationsRequestParams,
  GetAssetValuationsResponseData
} from '@/app/api/v1/assets';
import type { Portfolio } from '@/app/api/v1/portfolios';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe } from '@/types';

import { requirePortfolio, useRefreshPortfolio } from './use-portfolio';

const ASSETS_STALE_TIME_MS = 60_000;

const toValuationsBySymbol = ({
  data
}: AxiosResponse<GetAssetValuationsResponseData>): ReadonlyMap<
  string,
  AssetValuation
> => new Map(data.valuations.map((valuation) => [valuation.symbol, valuation]));

export const useAssets = (
  portfolio: Maybe<Portfolio>,
  requestedPage: Pick<GetAssetRequestParams, 'page' | 'limit'>
) =>
  useQuery<
    AxiosResponse<GetAssetResponseData>,
    ApiProxyErrorData,
    GetAssetResponseData
  >({
    queryKey: queryKeys.assets(portfolio?.id, requestedPage),
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/assets', {
            params: {
              portfolioId: portfolio.id,
              sort: 'desc',
              page: requestedPage.page,
              limit: requestedPage.limit
            }
          })
      : skipToken,
    select: ({ data }) => data,
    staleTime: ASSETS_STALE_TIME_MS
  });

export const useAssetValuations = (
  portfolio: Maybe<Portfolio>,
  listing: Maybe<GetAssetResponseData>
) => {
  const listedSymbols = listing?.assets.map(({ symbol }) => symbol) ?? [];

  return useQuery<
    AxiosResponse<GetAssetValuationsResponseData>,
    ApiProxyErrorData,
    ReadonlyMap<string, AssetValuation>
  >({
    queryKey: queryKeys.assetValuations(portfolio?.id, listedSymbols),
    queryFn:
      portfolio && listedSymbols.length > 0
        ? () =>
            api.getInstance().get('/v1/assets/valuations', {
              params: {
                portfolioId: portfolio.id,
                symbols: listedSymbols.join(',')
              } satisfies GetAssetValuationsRequestParams
            })
        : skipToken,
    select: toValuationsBySymbol,
    staleTime: ASSETS_STALE_TIME_MS
  });
};

export const useCreateAsset = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  return useMutation<
    AxiosResponse<CreateAssetResponseData>,
    ApiProxyErrorData,
    Omit<CreateAssetRequestPayload, 'portfolioId'>
  >({
    mutationFn: (payload) =>
      api.getInstance().post('/v1/assets/create', {
        ...payload,
        portfolioId: requirePortfolio(portfolio).id
      } satisfies CreateAssetRequestPayload),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refreshPortfolio();
    },
    onError: (e) => toast.error(e.message)
  });
};

export const useDeleteAsset = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  return useMutation<
    AxiosResponse<DeleteAssetResponseData>,
    ApiProxyErrorData,
    DeleteAssetRequestPayload
  >({
    mutationFn: ({ symbol }) =>
      api.getInstance().delete(`/v1/assets/${encodeURIComponent(symbol)}`, {
        params: { portfolioId: requirePortfolio(portfolio).id }
      }),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refreshPortfolio();
    },
    onError: (e) => toast.error(e.message)
  });
};
