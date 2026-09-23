'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import {
  APP_ROUTES,
  ASSET_DIALOG_ACTIONS,
  ASSET_DIALOG_PARAMS
} from '@/common/constants';
import { replaceUrlQuery } from '@/common/utils';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { Button } from '@/components/ui';
import { useCreateAsset, useDeleteAsset } from '@/hooks/use-assets';
import { useDisclosure } from '@/hooks/use-disclosure';
import { useActivePortfolio } from '@/hooks/use-portfolio';
import { useCreateTransaction } from '@/hooks/use-transactions';
import type { Maybe } from '@/types';

import { AddAssetDialog } from './_components/add-asset-dialog';
import { PositionsTable } from './_components/positions-table';

type AssetDialogActions =
  (typeof ASSET_DIALOG_ACTIONS)[keyof typeof ASSET_DIALOG_ACTIONS];

const DIALOG_ACTIONS: Array<AssetDialogActions> =
  Object.values(ASSET_DIALOG_ACTIONS);

export default function Assets() {
  const [dialogAction, setDialogAction] =
    useState<Maybe<AssetDialogActions>>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<Maybe<string>>(null);
  const [hasDeletedAsset, setHasDeletedAsset] = useState(false);

  const [opened, { toggle }] = useDisclosure(false);

  const addAssetButtonRef = useRef<HTMLButtonElement>(null);

  const searchParams = useSearchParams();

  const handleToggleDialog = useCallback(
    (action?: AssetDialogActions) => {
      if (opened && !action) {
        const params = new URLSearchParams(searchParams);

        params.delete(ASSET_DIALOG_PARAMS.Action);
        params.delete(ASSET_DIALOG_PARAMS.Symbol);

        replaceUrlQuery(params);
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
  } = useActivePortfolio();

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
    else if (requestedAction !== ASSET_DIALOG_ACTIONS.Add) return;

    if (!opened) handleToggleDialog(requestedAction);
  }, [searchParams, opened, handleToggleDialog]);

  useEffect(() => {
    if (!hasDeletedAsset || opened) return;

    setHasDeletedAsset(false);
    addAssetButtonRef.current?.focus();
  }, [hasDeletedAsset, opened]);

  return (
    <div className="space-y-6">
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
              ref={addAssetButtonRef}
              size="sm"
              className="max-sm:w-full"
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
        <EmptyState
          message="No portfolio found for this account"
          action={{
            label: 'Create a portfolio',
            href: APP_ROUTES.Protected.Portfolios
          }}
        />
      )}

      {portfolio && (
        <PositionsTable
          portfolio={portfolio}
          onAddAsset={() => handleToggleDialog(ASSET_DIALOG_ACTIONS.Add)}
          onAddTransaction={openDialogFor(ASSET_DIALOG_ACTIONS.AddTransaction)}
          onDeleteAsset={openDialogFor(ASSET_DIALOG_ACTIONS.Delete)}
        />
      )}

      {portfolio && opened && dialogAction === ASSET_DIALOG_ACTIONS.Add && (
        <AddAssetDialog
          onCancel={() => handleToggleDialog()}
          onConfirm={createAssetMutation}
        />
      )}

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

      {portfolio &&
        opened &&
        dialogAction === ASSET_DIALOG_ACTIONS.Delete &&
        typeof selectedSymbol === 'string' && (
          <ConfirmDeletionDialog
            title={`Delete ${selectedSymbol}?`}
            description={`Every transaction of ${selectedSymbol} in ${portfolio.name} is deleted with it, and this cannot be undone.`}
            confirmLabel="Delete asset"
            failureMessage="The asset could not be deleted"
            onCancel={() => handleToggleDialog()}
            onConfirm={async () => {
              await deleteAssetMutation({ symbol: selectedSymbol });
              setHasDeletedAsset(true);
              handleToggleDialog();
            }}
          />
        )}
    </div>
  );
}
