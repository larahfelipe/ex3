import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type {
  CreateAssetRequestPayload,
  CreateAssetResponseData,
  DeleteAssetRequestPayload,
  DeleteAssetResponseData
} from '@/app/api/v1/assets';
import type { Portfolio } from '@/app/api/v1/portfolios';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe } from '@/types';

import { requirePortfolio, useAnnouncePortfolioChange } from './use-portfolio';

export const useCreateAsset = (portfolio: Maybe<Portfolio>) => {
  const queryClient = useQueryClient();
  const announceChange = useAnnouncePortfolioChange(portfolio);

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
    onSuccess: async (response, { instrument }) => {
      await Promise.all([
        announceChange(response),
        instrument !== undefined &&
          queryClient.invalidateQueries({
            queryKey: queryKeys.visibleInstruments()
          })
      ]);
    }
  });
};

export const useDeleteAsset = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);

  return useMutation<
    AxiosResponse<DeleteAssetResponseData>,
    ApiProxyErrorData,
    DeleteAssetRequestPayload
  >({
    mutationFn: ({ symbol }) =>
      api.getInstance().delete(`/v1/assets/${encodeURIComponent(symbol)}`, {
        params: { portfolioId: requirePortfolio(portfolio).id }
      }),
    onSuccess: announceChange,
    onError: (e) => toast.error(e.message)
  });
};
