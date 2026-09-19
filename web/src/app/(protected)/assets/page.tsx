'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';

import { ASSET_DIALOG_ACTIONS, ASSET_DIALOG_PARAMS } from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { Button } from '@/components/ui';
import { useCreateAsset, useDeleteAsset } from '@/hooks/use-assets';
import { useDisclosure } from '@/hooks/use-disclosure';
import { usePrimaryPortfolio } from '@/hooks/use-portfolio';
import { useCreateTransaction } from '@/hooks/use-transactions';
import type { Maybe } from '@/types';

import {
  AddAssetDialog,
  AddAssetSchema,
  type AddAssetSchemaType
} from './_components/add-asset-dialog';
import { DeleteAssetDialog } from './_components/delete-asset-dialog';
import { PositionsTable } from './_components/positions-table';

type AssetDialogActions =
  (typeof ASSET_DIALOG_ACTIONS)[keyof typeof ASSET_DIALOG_ACTIONS];

const DIALOG_ACTIONS: Array<AssetDialogActions> =
  Object.values(ASSET_DIALOG_ACTIONS);

export default function Assets() {
  const [dialogAction, setDialogAction] =
    useState<Maybe<AssetDialogActions>>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<Maybe<string>>(null);

  const [opened, { toggle }] = useDisclosure(false);

  const searchParams = useSearchParams();

  const addAssetFormMethods = useForm<AddAssetSchemaType>({
    mode: 'onChange',
    resolver: zodResolver(AddAssetSchema),
    defaultValues: {
      symbol: ''
    }
  });

  const handleToggleDialog = useCallback(
    (action?: AssetDialogActions) => {
      if (opened && !action) {
        const params = new URLSearchParams(searchParams);

        params.delete(ASSET_DIALOG_PARAMS.Action);
        params.delete(ASSET_DIALOG_PARAMS.Symbol);

        updateUrlQuery(params);
      }

      if (action && action !== dialogAction) setDialogAction(action);

      toggle();
    },
    [dialogAction, opened, searchParams, toggle]
  );

  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = usePrimaryPortfolio();

  const { mutateAsync: createAssetMutation } = useCreateAsset(portfolio);

  const { mutateAsync: createTransaction } = useCreateTransaction(portfolio);

  const { mutateAsync: deleteAssetMutation } = useDeleteAsset(portfolio);

  const openDialogFor = (action: AssetDialogActions) => (symbol: string) => {
    setSelectedSymbol(symbol);
    handleToggleDialog(action);
  };

  useEffect(() => {
    const requestedAction = DIALOG_ACTIONS.find(
      (action) => action === searchParams.get(ASSET_DIALOG_PARAMS.Action)
    );

    if (!requestedAction) return;

    const requestedSymbol = searchParams.get(ASSET_DIALOG_PARAMS.Symbol);

    if (requestedSymbol) setSelectedSymbol(requestedSymbol.toUpperCase());
    else if (requestedAction === ASSET_DIALOG_ACTIONS.AddTransaction) return;

    if (!opened) handleToggleDialog(requestedAction);
  }, [searchParams, opened, handleToggleDialog]);

  return (
    <div className="space-y-6 px-3 py-8 sm:px-4">
      <PageHeader
        title="Assets"
        isPending={isPending}
        description={
          portfolio
            ? `${portfolio.name} · Base currency ${portfolio.baseCurrency}`
            : undefined
        }
        action={
          portfolio && (
            <Button
              className="h-9 max-sm:w-full"
              onClick={() => handleToggleDialog(ASSET_DIALOG_ACTIONS.Add)}
            >
              Add asset
            </Button>
          )
        }
      />

      {isPending && (
        <LoadingState label="Loading your portfolio" className="h-96" />
      )}

      {isError && !portfolio && (
        <ErrorState
          message="Your portfolio could not be loaded"
          onRetry={refetch}
        />
      )}

      {isSuccess && !portfolio && (
        <EmptyState message="No portfolio found for this account" />
      )}

      {portfolio && (
        <PositionsTable
          portfolio={portfolio}
          onAddAsset={() => handleToggleDialog(ASSET_DIALOG_ACTIONS.Add)}
          onAddTransaction={openDialogFor(ASSET_DIALOG_ACTIONS.AddTransaction)}
          onDeleteAsset={openDialogFor(ASSET_DIALOG_ACTIONS.Delete)}
        />
      )}

      <FormProvider {...addAssetFormMethods}>
        <AddAssetDialog
          open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Add}
          onCancel={handleToggleDialog}
          onConfirm={createAssetMutation}
        />
      </FormProvider>

      {portfolio &&
        opened &&
        dialogAction === ASSET_DIALOG_ACTIONS.AddTransaction &&
        typeof selectedSymbol === 'string' && (
          <TransactionFormDialog
            target={{
              kind: 'create',
              symbol: selectedSymbol,
              currency: portfolio.baseCurrency
            }}
            onCancel={() => handleToggleDialog()}
            onSubmit={async (draft) => {
              await createTransaction({
                ...draft,
                assetSymbol: selectedSymbol
              });
              handleToggleDialog();
            }}
          />
        )}

      <DeleteAssetDialog
        open={opened && dialogAction === ASSET_DIALOG_ACTIONS.Delete}
        symbol={selectedSymbol}
        onCancel={handleToggleDialog}
        onConfirm={deleteAssetMutation}
      />
    </div>
  );
}
