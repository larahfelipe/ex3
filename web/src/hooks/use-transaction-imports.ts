import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  CreateTransactionImportRequestPayload,
  CreateTransactionImportResponseData,
  GetTransactionImportsRequestParams,
  GetTransactionImportsResponseData,
  ImportFilePayload,
  PreviewTransactionImportRequestPayload,
  PreviewTransactionImportResponseData,
  TransactionImport,
  UndoTransactionImportResponseData
} from '@/app/api/v1/transaction-imports';
import { TRANSACTION_IMPORT } from '@/common/constants';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
import type { Maybe, PageParams } from '@/types';

import {
  requirePortfolio,
  useAnnouncePortfolioChange,
  usePortfolioScopedQuery
} from './use-portfolio';

type ImportRequest = Record<'file', ImportFilePayload> &
  Partial<Record<'selectedKeys', Array<string>>>;

const IMPORT_REQUEST_CONFIG = { timeout: TRANSACTION_IMPORT.RequestTimeoutMs };

export const useTransactionImports = (
  portfolio: Maybe<Portfolio>,
  requestedPage: PageParams
) =>
  usePortfolioScopedQuery<GetTransactionImportsResponseData>({
    queryKey: queryKeys.transactionImports(portfolio?.id, requestedPage),
    portfolio,
    request: (portfolioId) =>
      api.getInstance().get('/v1/transaction-imports', {
        params: {
          ...requestedPage,
          portfolioId
        } satisfies GetTransactionImportsRequestParams
      }),
    keepsPreviousPage: true
  });

export const usePreviewTransactionImport = (portfolio: Maybe<Portfolio>) =>
  useMutation<
    AxiosResponse<PreviewTransactionImportResponseData>,
    ApiProxyErrorData,
    ImportRequest
  >({
    mutationFn: ({ file, selectedKeys }) =>
      api.getInstance().post(
        '/v1/transaction-imports/preview',
        {
          portfolioId: requirePortfolio(portfolio).id,
          file,
          selectedKeys
        } satisfies PreviewTransactionImportRequestPayload,
        IMPORT_REQUEST_CONFIG
      )
  });

export const useCreateTransactionImport = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);
  const queryClient = useQueryClient();
  const t = useTranslations('imports.notifications');

  return useMutation<
    AxiosResponse<CreateTransactionImportResponseData>,
    ApiProxyErrorData,
    Required<ImportRequest>
  >({
    mutationFn: ({ file, selectedKeys }) =>
      api.getInstance().post(
        '/v1/transaction-imports/create',
        {
          portfolioId: requirePortfolio(portfolio).id,
          file,
          selectedKeys
        } satisfies CreateTransactionImportRequestPayload,
        IMPORT_REQUEST_CONFIG
      ),
    onSuccess: ({ data: { transactionImport } }) => {
      announceChange({
        title: t('imported', { count: transactionImport.importedCount })
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visibleInstruments()
      });
    }
  });
};

export const useUndoTransactionImport = (portfolio: Maybe<Portfolio>) => {
  const announceChange = useAnnouncePortfolioChange(portfolio);
  const t = useTranslations('imports.notifications');

  return useMutation<
    AxiosResponse<UndoTransactionImportResponseData>,
    ApiProxyErrorData,
    Pick<TransactionImport, 'id'>
  >({
    mutationFn: ({ id }) =>
      api
        .getInstance()
        .delete(`/v1/transaction-imports/${encodeURIComponent(id)}`),
    onSuccess: () => announceChange({ title: t('undone') })
  });
};
