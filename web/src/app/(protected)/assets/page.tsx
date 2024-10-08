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
  CreateAssetRequestPayload,
  CreateAssetResponseData,
  DeleteAssetRequestPayload,
  DeleteAssetResponseData,
  GetAssetResponseData
} from '@/app/api/v1/assets';
import type {
  CreateTransactionRequestPayload,
  CreateTransactionResponseData
} from '@/app/api/v1/transactions';
import { ASSET_DIALOG_ACTIONS, TRANSACTION_TYPES } from '@/common/constants';
import { formatNumber, replaceUrl } from '@/common/utils';
import { Card } from '@/components/ui';
import { useDisclosure } from '@/hooks/use-disclosure';
import api, { type ApiErrorData } from '@/lib/axios';
import type { Maybe, Pagination as TPagination } from '@/types';

import {
  AddAssetDialog,
  AddAssetSchema,
  type AddAssetSchemaType
} from './_components/add-asset-dialog';
import {
  AddAssetTransactionDialog,
  AddAssetTransactionSchema,
  type AddAssetTransactionSchemaType
} from './_components/add-asset-transaction-dialog';
import { AssetsTable, type DispatchType } from './_components/assets-table';
import { DeleteAssetDialog } from './_components/delete-asset-dialog';

type AssetDialogActions =
  (typeof ASSET_DIALOG_ACTIONS)[keyof typeof ASSET_DIALOG_ACTIONS];

export type AssetsResult = Omit<GetAssetResponseData, 'sort'> & {
  totalBalance: number;
  sort?: GetAssetResponseData['sort']['order'];
};

export const LimitPerPageOptions = ['5', '10', '25', '50'];

export const PaginationInitialState = {
  page: 1,
  limit: +LimitPerPageOptions[0]
} as TPagination;

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

  const addAssetTransactionFormMethods = useForm<AddAssetTransactionSchemaType>(
    {
      mode: 'onBlur',
      resolver: zodResolver(AddAssetTransactionSchema),
      defaultValues: {
        type: TRANSACTION_TYPES[0],
        price: 0
      }
    }
  );

  const handleToggleDialog = useCallback(
    (action?: AssetDialogActions) => {
      if (opened && !action) replaceUrl(window.location.pathname);

      if (action && action !== dialogAction) setDialogAction(action);

      toggle();
    },
    [dialogAction, opened, toggle]
  );

  const { data, isLoading, isRefetching, refetch } = useQuery<
    AxiosResponse<GetAssetResponseData>,
    ApiErrorData,
    AssetsResult
  >({
    queryKey: ['assets', pagination],
    queryFn: () =>
      api.client.get('/v1/assets', {
        params: {
          sort: 'desc',
          page: pagination.page,
          limit: pagination.limit
        }
      }),
    select: ({ data }) => {
      let result: AssetsResult = {
        assets: [],
        totalBalance: 0,
        pagination: PaginationInitialState
      };

      try {
        const totalBalance = data.assets.reduce(
          (acc, curr) => (acc += curr.balance),
          0
        );
        const assetsWithDominance = data.assets.map((a) => {
          a.dominance =
            totalBalance > 0
              ? formatNumber(a.balance / totalBalance, {
                  style: 'percent',
                  maximumFractionDigits: 2
                })
              : '0%';
          return a;
        });
        result = {
          totalBalance,
          assets: assetsWithDominance,
          pagination: data.pagination,
          ...(data?.sort?.order && { sort: data.sort.order })
        };
      } catch (e) {
        console.error(e);
      }

      return result;
    },
    staleTime: 60_000
  });

  const { mutateAsync: createAssetMutation } = useMutation<
    AxiosResponse<CreateAssetResponseData>,
    ApiErrorData,
    CreateAssetRequestPayload
  >({
    mutationFn: (payload) => api.client.post('/v1/assets/create', payload),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: createAssetTransactionMutation } = useMutation<
    AxiosResponse<CreateTransactionResponseData>,
    ApiErrorData,
    CreateTransactionRequestPayload
  >({
    mutationFn: (payload) => api.client.post('/v1/transactions', payload),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      if (searchParams.size) replaceUrl(window.location.pathname);
      await refetch();
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: deleteAssetMutation } = useMutation<
    AxiosResponse<DeleteAssetResponseData>,
    ApiErrorData,
    DeleteAssetRequestPayload
  >({
    mutationFn: ({ symbol }) => api.client.delete(`/v1/assets/${symbol}`),
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
          data={{ pagination, selectedAsset, result: data }}
          loading={isLoading || isRefetching}
          onDispatch={handleDispatch}
        />
      </Card>
    </>
  );
}
