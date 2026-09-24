import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

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

/** `addTransactionFor`, when given, is offered in the toast for the asset just added. */
export const useCreateAsset = (
  portfolio: Maybe<Portfolio>,
  addTransactionFor?: (symbol: string) => void
) => {
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
    onSuccess: ({ data: { asset } }, { listing }) => {
      announceChange({
        title: 'Asset added',
        description: portfolio
          ? `${asset.symbol} is now in ${portfolio.name}`
          : undefined,
        action: addTransactionFor && {
          label: 'Add transaction',
          onSelect: () => addTransactionFor(asset.symbol)
        }
      });

      if (listing !== undefined)
        void queryClient.invalidateQueries({
          queryKey: queryKeys.visibleInstruments()
        });
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
    onSuccess: ({ data }) => announceChange({ title: data.message })
  });
};
