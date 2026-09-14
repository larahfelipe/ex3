'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ASSET_DIALOG_ACTIONS, TRANSACTION_TYPES } from '@/common/constants';
import { replaceUrl } from '@/common/utils';
import { Card } from '@/components/ui';
import {
  useAssets,
  useAssetValuations,
  useCreateAsset,
  useDeleteAsset
} from '@/hooks/use-assets';
import { useDisclosure } from '@/hooks/use-disclosure';
import {
  usePrimaryPortfolio,
  useRefreshPortfolio
} from '@/hooks/use-portfolio';
import { useCreateTransaction } from '@/hooks/use-transactions';
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

export type PageRequest = Pick<TPagination, 'page' | 'limit'>;

export const LimitPerPageOptions = ['5', '10', '25', '50'];

export const PaginationInitialState: PageRequest = {
  page: 1,
  limit: +LimitPerPageOptions[0]
};

export default function Assets() {
  const [dialogAction, setDialogAction] = useState('' as AssetDialogActions);
  const [selectedSymbol, setSelectedSymbol] = useState<Maybe<string>>(null);
  const [requestedPage, setRequestedPage] = useState<PageRequest>(
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

  const { data: portfolio, isLoading: isLoadingPortfolio } =
    usePrimaryPortfolio();

  const refreshPortfolio = useRefreshPortfolio(portfolio);

  const { data, isLoading, isRefetching } = useAssets(portfolio, requestedPage);

  const { data: valuations, isLoading: isLoadingValuations } =
    useAssetValuations(portfolio, data);

  const { mutateAsync: createAssetMutation } = useCreateAsset(portfolio);

  const { mutateAsync: createAssetTransactionMutation } =
    useCreateTransaction(portfolio);

  const { mutateAsync: deleteAssetMutation } = useDeleteAsset(portfolio);

  const handleDispatch = useCallback(
    async (type: DispatchType, payload?: unknown) => {
      try {
        switch (type) {
          case 'refetchAssets':
            await refreshPortfolio();
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
            if (typeof payload !== 'string')
              throw new Error('Missing asset symbol');
            setSelectedSymbol(payload);
            handleToggleDialog(ASSET_DIALOG_ACTIONS.Delete);
            break;
          case 'setSelectedAsset':
            setSelectedSymbol(typeof payload === 'string' ? payload : null);
            break;
          case 'setPage':
            if (!payload) throw new Error('Missing page number');
            setRequestedPage((state) => ({
              ...state,
              page: payload as number
            }));
            break;
          case 'setLimit':
            if (typeof payload !== 'number')
              throw new Error('Missing limit param');
            setRequestedPage({
              page: PaginationInitialState.page,
              limit: payload
            });
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
    [refreshPortfolio, handleToggleDialog]
  );

  useEffect(() => {
    if (!searchParams.size) return;

    const maybeDialogAction = searchParams.get('action') as AssetDialogActions;
    if (!maybeDialogAction) return;

    const maybeAssetSymbol = searchParams.get('symbol');
    if (maybeAssetSymbol) setSelectedSymbol(maybeAssetSymbol.toUpperCase());

    if (!opened) handleToggleDialog(maybeDialogAction);
  }, [searchParams, opened, handleToggleDialog]);

  return (
    <>
      <FormProvider {...addAssetFormMethods}>
        <AddAssetDialog
          open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Add}
          onCancel={handleToggleDialog}
          onConfirm={createAssetMutation}
        />
      </FormProvider>

      <FormProvider {...addAssetTransactionFormMethods}>
        <AddAssetTransactionDialog
          open={opened && dialogAction === ASSET_DIALOG_ACTIONS.AddTransaction}
          symbol={selectedSymbol}
          currency={portfolio?.baseCurrency}
          onCancel={handleToggleDialog}
          onConfirm={(payload) =>
            createAssetTransactionMutation(payload, {
              onSuccess: () => {
                if (searchParams.size) replaceUrl(window.location.pathname);
              }
            })
          }
        />
      </FormProvider>

      <DeleteAssetDialog
        open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Delete}
        symbol={selectedSymbol}
        onCancel={handleToggleDialog}
        onConfirm={deleteAssetMutation}
      />

      <Card className="h-fit mt-8 px-5 py-8 mx-3 shadow-none sm:mx-4 sm:pt-6 sm:pb-2">
        <AssetsTable
          data={{
            requestedPage,
            selectedSymbol,
            baseCurrency: portfolio?.baseCurrency,
            result: data,
            valuations
          }}
          loading={isLoadingPortfolio || isLoading || isRefetching}
          loadingValuations={isLoadingValuations}
          onDispatch={handleDispatch}
        />
      </Card>
    </>
  );
}
