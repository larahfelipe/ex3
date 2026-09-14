import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type { Asset } from '@/app/api/v1/assets';
import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  CreateTransactionRequestPayload,
  CreateTransactionResponseData,
  GetTransactionCountResponseData,
  GetTransactionsRequestParams,
  GetTransactionsResponseData,
  TransactionFilters
} from '@/app/api/v1/transactions';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import type { Maybe } from '@/types';

import { requirePortfolio } from './use-portfolio';

const TRANSACTION_COUNT_STALE_TIME_MS = 30_000;

export const useTransactions = (
  portfolio: Maybe<Portfolio>,
  filters: TransactionFilters
) =>
  useQuery<
    AxiosResponse<GetTransactionsResponseData>,
    ApiProxyErrorData,
    GetTransactionsResponseData
  >({
    queryKey: ['transactions', portfolio?.id, filters],
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/transactions', {
            params: {
              ...filters,
              portfolioId: portfolio.id
            } satisfies GetTransactionsRequestParams
          })
      : skipToken,
    select: ({ data }) => data
  });

export const useTransactionCount = ({
  symbol,
  portfolioId
}: Pick<Asset, 'symbol' | 'portfolioId'>) =>
  useQuery<
    AxiosResponse<GetTransactionCountResponseData>,
    ApiProxyErrorData,
    GetTransactionCountResponseData
  >({
    queryKey: ['transactions', 'count', portfolioId, symbol],
    queryFn: () =>
      api
        .getInstance()
        .get(`/v1/transactions/${encodeURIComponent(symbol)}/count`, {
          params: { portfolioId }
        }),
    select: ({ data }) => data,
    staleTime: TRANSACTION_COUNT_STALE_TIME_MS
  });

export const useCreateTransaction = (portfolio: Maybe<Portfolio>) => {
  const queryClient = useQueryClient();

  return useMutation<
    AxiosResponse<CreateTransactionResponseData>,
    ApiProxyErrorData,
    Omit<CreateTransactionRequestPayload, 'portfolioId' | 'currency'>
  >({
    mutationFn: (payload) => {
      const { id, baseCurrency } = requirePortfolio(portfolio);

      return api.getInstance().post('/v1/transactions/create', {
        ...payload,
        portfolioId: id,
        currency: baseCurrency
      } satisfies CreateTransactionRequestPayload);
    },
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await queryClient.invalidateQueries({
        queryKey: ['assets', portfolio?.id]
      });
    },
    onError: (e) => toast.error(e.message)
  });
};
