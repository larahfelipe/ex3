'use client';

import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useSearchParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';

import { ASSET_DIALOG_ACTIONS } from '@/common/constants';
import { replaceUrl } from '@/common/utils';
import { LoadErrorAlert } from '@/components/load-error-alert';
import { PageHeader } from '@/components/page-header';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { Button, Skeleton } from '@/components/ui';
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
      if (opened && !action) replaceUrl(window.location.pathname);
      if (action && action !== dialogAction) setDialogAction(action);

      toggle();
    },
    [dialogAction, opened, toggle]
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
    if (!searchParams.size) return;

    const maybeDialogAction = searchParams.get('action') as AssetDialogActions;
    if (!maybeDialogAction) return;

    const maybeAssetSymbol = searchParams.get('symbol');
    if (maybeAssetSymbol) setSelectedSymbol(maybeAssetSymbol.toUpperCase());
    else if (maybeDialogAction === ASSET_DIALOG_ACTIONS.AddTransaction) return;

    if (!opened) handleToggleDialog(maybeDialogAction);
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
        <div aria-busy="true">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {isError && !portfolio && (
        <LoadErrorAlert
          message="Your portfolio could not be loaded"
          onRetry={refetch}
        />
      )}

      {isSuccess && !portfolio && (
        <p className="text-sm text-muted-foreground">
          No portfolio found for this account
        </p>
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
