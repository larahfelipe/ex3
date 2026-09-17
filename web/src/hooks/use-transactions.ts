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
  DeleteTransactionResponseData,
  GetTransactionsRequestParams,
  GetTransactionsResponseData,
  Transaction,
  TransactionFilters,
  UpdateTransactionRequestPayload,
  UpdateTransactionResponseData
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
    }
  });
};

export const useUpdateTransaction = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  return useMutation<
    AxiosResponse<UpdateTransactionResponseData>,
    ApiProxyErrorData,
    UpdateTransactionRequestPayload & Pick<Transaction, 'id'>
  >({
    mutationFn: ({ id, ...payload }) =>
      api
        .getInstance()
        .patch(
          `/v1/transactions/${encodeURIComponent(id)}`,
          payload satisfies UpdateTransactionRequestPayload
        ),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refreshPortfolio();
    }
  });
};

export const useDeleteTransaction = (portfolio: Maybe<Portfolio>) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  return useMutation<
    AxiosResponse<DeleteTransactionResponseData>,
    ApiProxyErrorData,
    Pick<Transaction, 'id'>
  >({
    mutationFn: ({ id }) =>
      api.getInstance().delete(`/v1/transactions/${encodeURIComponent(id)}`),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refreshPortfolio();
    }
  });
};
