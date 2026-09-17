import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery
} from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  CreateTransactionRequestPayload,
  CreateTransactionResponseData,
  GetTransactionsRequestParams,
  GetTransactionsResponseData,
  TransactionFilters
} from '@/app/api/v1/transactions';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe } from '@/types';

import { requirePortfolio, useRefreshPortfolio } from './use-portfolio';

export const useTransactions = (
  portfolio: Maybe<Portfolio>,
  filters: TransactionFilters
) =>
  useQuery<
    AxiosResponse<GetTransactionsResponseData>,
    ApiProxyErrorData,
    GetTransactionsResponseData
  >({
    queryKey: queryKeys.transactions(portfolio?.id, filters),
    queryFn: portfolio
      ? () =>
          api.getInstance().get('/v1/transactions', {
            params: {
              ...filters,
              portfolioId: portfolio.id
            } satisfies GetTransactionsRequestParams
          })
      : skipToken,
    select: ({ data }) => data,
    placeholderData: keepPreviousData
  });

export const useCreateTransaction = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

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
      await refreshPortfolio();
    },
    onError: (e) => toast.error(e.message)
  });
};
