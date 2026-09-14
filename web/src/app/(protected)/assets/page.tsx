'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type {
  Asset,
  AssetValuation,
  CreateAssetRequestPayload,
  CreateAssetResponseData,
  DeleteAssetRequestPayload,
  DeleteAssetResponseData,
  GetAssetValuationsRequestParams,
  GetAssetValuationsResponseData,
  GetAssetWithTotalInvestedValueResponseData
} from '@/app/api/v1/assets';
import type {
  GetPortfoliosRequestParams,
  GetPortfoliosResponseData,
  Portfolio
} from '@/app/api/v1/portfolios';
import type {
  CreateTransactionRequestPayload,
  CreateTransactionResponseData
} from '@/app/api/v1/transactions';
import { ASSET_DIALOG_ACTIONS, TRANSACTION_TYPES } from '@/common/constants';
import { replaceUrl } from '@/common/utils';
import { Card } from '@/components/ui';
import { useDisclosure } from '@/hooks/use-disclosure';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import type { Maybe, Pagination as TPagination } from '@/types';

import {
  AddAssetDialog,
  AddAssetSchema,
  type AddAssetSchemaType
} from './_components/add-asset-dialog';
import {
  AddAssetTransactionDialog,
  AddAssetTransactionSchema,
  type AddAssetTransactionSchemaInput,
  type AddAssetTransactionSchemaType
} from './_components/add-asset-transaction-dialog';
import { AssetsTable, type DispatchType } from './_components/assets-table';
import { DeleteAssetDialog } from './_components/delete-asset-dialog';

type AssetDialogActions =
  (typeof ASSET_DIALOG_ACTIONS)[keyof typeof ASSET_DIALOG_ACTIONS];

export const LimitPerPageOptions = ['5', '10', '25', '50'];

export const PaginationInitialState = {
  page: 1,
  limit: +LimitPerPageOptions[0]
} as TPagination;

/** Portfolios are listed in creation order, so this page holds the one the account was created with. */
const PRIMARY_PORTFOLIO_PAGE: GetPortfoliosRequestParams = {
  page: 1,
  limit: 1
};

const toValuationsBySymbol = ({
  data
}: AxiosResponse<GetAssetValuationsResponseData>): ReadonlyMap<
  string,
  AssetValuation
> => new Map(data.valuations.map((valuation) => [valuation.symbol, valuation]));

export default function Assets() {
  const [dialogAction, setDialogAction] = useState('' as AssetDialogActions);
  const [selectedAsset, setSelectedAsset] = useState<Maybe<Asset>>(null);
  const [pagination, setPagination] = useState<TPagination>(
    PaginationInitialState
  );

  const [opened, { toggle }] = useDisclosure(false);

  const searchParams = useSearchParams();

  const addAssetFormMethods = useForm<AddAssetSchemaType>({
    mode: 'onChange',
    resolver: zodResolver(AddAssetSchema),
    defaultValues: {
      symbol: ''
    }
  });

  const addAssetTransactionFormMethods = useForm<
    AddAssetTransactionSchemaInput,
    unknown,
    AddAssetTransactionSchemaType
  >({
    mode: 'onBlur',
    resolver: zodResolver(AddAssetTransactionSchema),
    defaultValues: {
      type: TRANSACTION_TYPES[0],
      quantity: '',
      unitPrice: '',
      executedAt: ''
    }
  });

  const handleToggleDialog = useCallback(
    (action?: AssetDialogActions) => {
      if (opened && !action) replaceUrl(window.location.pathname);
      if (action && action !== dialogAction) setDialogAction(action);

      toggle();
    },
    [dialogAction, opened, toggle]
  );

  const { data: portfolio, isLoading: isLoadingPortfolio } = useQuery<
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
    staleTime: 60_000
  });

  const requirePortfolio = () => {
    if (!portfolio) throw new Error('Missing portfolio');

    return portfolio;
  };

  const { data, dataUpdatedAt, isLoading, isRefetching, refetch } = useQuery<
    AxiosResponse<GetAssetWithTotalInvestedValueResponseData>,
    ApiProxyErrorData,
    GetAssetWithTotalInvestedValueResponseData
  >({
    queryKey: ['assets', portfolio?.id, pagination],
    queryFn: () =>
      api.getInstance().get('/v1/assets', {
        params: {
          portfolioId: requirePortfolio().id,
          sort: 'desc',
          page: pagination.page,
          limit: pagination.limit
        }
      }),
    select: ({ data }) => data,
    enabled: !!portfolio,
    staleTime: 60_000
  });

  const listedSymbols = data?.assets.map(({ symbol }) => symbol) ?? [];

  const { data: valuations, isLoading: isLoadingValuations } = useQuery<
    AxiosResponse<GetAssetValuationsResponseData>,
    ApiProxyErrorData,
    ReadonlyMap<string, AssetValuation>
  >({
    queryKey: ['asset-valuations', portfolio?.id, listedSymbols, dataUpdatedAt],
    queryFn: () =>
      api.getInstance().get('/v1/assets/valuations', {
        params: {
          portfolioId: requirePortfolio().id,
          symbols: listedSymbols.join(',')
        } satisfies GetAssetValuationsRequestParams
      }),
    select: toValuationsBySymbol,
    enabled: !!portfolio && listedSymbols.length > 0,
    staleTime: 60_000
  });

  const { mutateAsync: createAssetMutation } = useMutation<
    AxiosResponse<CreateAssetResponseData>,
    ApiProxyErrorData,
    Omit<CreateAssetRequestPayload, 'portfolioId'>
  >({
    mutationFn: (payload) =>
      api.getInstance().post('/v1/assets/create', {
        ...payload,
        portfolioId: requirePortfolio().id
      } satisfies CreateAssetRequestPayload),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: createAssetTransactionMutation } = useMutation<
    AxiosResponse<CreateTransactionResponseData>,
    ApiProxyErrorData,
    Omit<CreateTransactionRequestPayload, 'portfolioId' | 'currency'>
  >({
    mutationFn: (payload) => {
      const { id, baseCurrency } = requirePortfolio();

      return api.getInstance().post('/v1/transactions/create', {
        ...payload,
        portfolioId: id,
        currency: baseCurrency
      } satisfies CreateTransactionRequestPayload);
    },
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      if (searchParams.size) replaceUrl(window.location.pathname);
      await refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: deleteAssetMutation } = useMutation<
    AxiosResponse<DeleteAssetResponseData>,
    ApiProxyErrorData,
    DeleteAssetRequestPayload
  >({
    mutationFn: ({ symbol }) =>
      api.getInstance().delete(`/v1/assets/${symbol}`, {
        params: { portfolioId: requirePortfolio().id }
      }),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const handleDispatch = useCallback(
    async (type: DispatchType, payload?: unknown) => {
      try {
        switch (type) {
          case 'refetchAssets':
            await refetch();
            break;
          case 'createAsset':
            handleToggleDialog(ASSET_DIALOG_ACTIONS.Add);
            break;
          case 'createAssetTransaction':
            handleToggleDialog(ASSET_DIALOG_ACTIONS.AddTransaction);
            break;
          // TODO:
          // case 'editAsset':
          //   if (!payload) throw new Error('EditAssetError: Missing asset');
          //   setSelectedAsset(payload as Asset);
          //   break;
          case 'deleteAsset':
            if (!payload) throw new Error('Missing asset data');
            setSelectedAsset(payload as Asset);
            handleToggleDialog(ASSET_DIALOG_ACTIONS.Delete);
            break;
          case 'setSelectedAsset':
            setSelectedAsset(payload as Asset);
            break;
          case 'setPage':
            if (!payload) throw new Error('Missing page number');
            setPagination((state) => ({ ...state, page: payload as number }));
            break;
          case 'setLimit':
            if (!payload) throw new Error('Missing limit param');
            setPagination((state) => ({ ...state, limit: payload as number }));
            break;
          // TODO:
          // case 'setSortOrder':
          //   if (!payload)
          //     throw new Error('setSortOrderError: Missing sort param');
          //   break;
          default:
            throw new Error(`Dispatch type for "${type}" is not defined`);
        }
      } catch (e) {
        const { message } = e as Error;
        toast.error(message);
      }
    },
    [refetch, handleToggleDialog]
  );

  useEffect(() => {
    if (!searchParams.size) return;

    const maybeDialogAction = searchParams.get('action') as AssetDialogActions;
    if (!maybeDialogAction) return;

    const maybeAssetSymbol = searchParams.get('symbol');
    if (maybeAssetSymbol)
      setSelectedAsset({ symbol: maybeAssetSymbol.toUpperCase() } as Asset);

    if (!opened) handleToggleDialog(maybeDialogAction);
  }, [searchParams, opened, handleToggleDialog]);

  return (
    <>
      <FormProvider {...addAssetFormMethods}>
        <AddAssetDialog
          open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Add}
          data={selectedAsset as Asset}
          onCancel={handleToggleDialog}
          onConfirm={createAssetMutation}
        />
      </FormProvider>

      <FormProvider {...addAssetTransactionFormMethods}>
        <AddAssetTransactionDialog
          open={opened && dialogAction === ASSET_DIALOG_ACTIONS.AddTransaction}
          data={selectedAsset as Asset}
          currency={portfolio?.baseCurrency}
          onCancel={handleToggleDialog}
          onConfirm={createAssetTransactionMutation}
        />
      </FormProvider>

      <DeleteAssetDialog
        open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Delete}
        data={selectedAsset as Asset}
        onCancel={handleToggleDialog}
        onConfirm={deleteAssetMutation}
      />

      <Card className="h-fit mt-8 px-5 py-8 mx-3 shadow-none sm:mx-4 sm:pt-6 sm:pb-2">
        <AssetsTable
          data={{ pagination, selectedAsset, result: data, valuations }}
          loading={isLoadingPortfolio || isLoading || isRefetching}
          loadingValuations={isLoadingValuations}
          onDispatch={handleDispatch}
        />
      </Card>
    </>
  );
}
