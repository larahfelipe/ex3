'use client';

import { useEffect, useRef, useState } from 'react';

import { Plus } from 'lucide-react';

import { APP_ROUTES } from '@/common/constants';
import { AssetDialogs, type AssetDialog } from '@/components/asset-dialogs';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/use-portfolio';
import type { Maybe } from '@/types';

import { PositionsTable } from './_components/positions-table';

export default function Assets() {
  const [assetDialog, setAssetDialog] = useState<Maybe<AssetDialog>>(null);
  const [hasDeletedAsset, setHasDeletedAsset] = useState(false);

  const addAssetButtonRef = useRef<HTMLButtonElement>(null);

  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = useActivePortfolio();

  const openDialogFor =
    (kind: 'add-transaction' | 'delete-asset') => (symbol: string) =>
      setAssetDialog({ kind, symbol });

  useEffect(() => {
    if (!hasDeletedAsset || assetDialog !== null) return;

    setHasDeletedAsset(false);
    addAssetButtonRef.current?.focus();
  }, [hasDeletedAsset, assetDialog]);

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
              className="gap-1.5 max-sm:w-full"
              onClick={() => setAssetDialog({ kind: 'add-asset' })}
            >
              <Plus size={16} aria-hidden="true" />
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
        <>
          <PositionsTable
            portfolio={portfolio}
            onAddAsset={() => setAssetDialog({ kind: 'add-asset' })}
            onAddTransaction={openDialogFor('add-transaction')}
            onDeleteAsset={openDialogFor('delete-asset')}
          />

          <AssetDialogs
            portfolio={portfolio}
            dialog={assetDialog}
            onDialogChange={setAssetDialog}
            onAssetDeleted={() => setHasDeletedAsset(true)}
          />
        </>
      )}
    </div>
  );
}
