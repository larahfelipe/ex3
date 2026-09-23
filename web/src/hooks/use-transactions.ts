import { useMutation } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

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
import { TRANSACTION_TYPE_LABELS } from '@/common/constants';
import { formatPrice, formatQuantity } from '@/common/utils';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { formatExecutionDay } from '@/lib/dates';
import { queryKeys } from '@/lib/react-query';
import type { Maybe } from '@/types';

import {
  requirePortfolio,
  useAnnouncePortfolioChange,
  usePortfolioScopedQuery
} from './use-portfolio';

export const useTransactions = (
  portfolio: Maybe<Portfolio>,
  filters: TransactionFilters
) =>
  usePortfolioScopedQuery<GetTransactionsResponseData>({
    queryKey: queryKeys.transactions(portfolio?.id, filters),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/transactions', {
        params: {
          ...filters,
          portfolioId
        } satisfies GetTransactionsRequestParams
      }),
    keepsPreviousPage: true
  });

export const useCreateTransaction = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);

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
    onSuccess: ({ data: { transaction } }, { assetSymbol }) =>
      announceChange({
        title: `${TRANSACTION_TYPE_LABELS[transaction.type]} recorded`,
        description: `${formatQuantity(transaction.quantity)} ${assetSymbol} at ${formatPrice(transaction.unitPrice, transaction.currency)} on ${formatExecutionDay(transaction.executedAt)}`
      })
  });
};

export const useUpdateTransaction = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);

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
    onSuccess: ({ data }) => announceChange({ title: data.message })
  });
};

export const useDeleteTransaction = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);

  return useMutation<
    AxiosResponse<DeleteTransactionResponseData>,
    ApiProxyErrorData,
    Pick<Transaction, 'id'>
  >({
    mutationFn: ({ id }) =>
      api.getInstance().delete(`/v1/transactions/${encodeURIComponent(id)}`),
    onSuccess: ({ data }) => announceChange({ title: data.message })
  });
};
