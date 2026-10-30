'use client';

import { useEffect, useRef, useState } from 'react';

import { Plus, Wallet } from 'lucide-react';
import { useTranslations } from 'use-intl';

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
  const hasDeletedAssetRef = useRef(false);
  const addAssetButtonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations('investments.overview');
  const tNavigation = useTranslations('navigation.pages');

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
    if (!hasDeletedAssetRef.current || assetDialog !== null) return;

    hasDeletedAssetRef.current = false;
    addAssetButtonRef.current?.focus();
  }, [assetDialog]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNavigation('assets')}
        isPending={isPending}
        description={
          portfolio
            ? t('description', {
                name: portfolio.name,
                currency: portfolio.baseCurrency
              })
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

              {t('addAsset')}
            </Button>
          )
        }
      />

      {isPending && <LoadingState label={t('loading')} className="h-96" />}

      {isError && !portfolio && (
        <ErrorState message={t('loadFailed')} onRetry={refetch} />
      )}

      {isSuccess && !portfolio && (
        <EmptyState
          icon={Wallet}
          title={t('noPortfolioTitle')}
          message={t('noPortfolio')}
          action={{
            label: t('createPortfolio'),
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
            onAssetDeleted={() => {
              hasDeletedAssetRef.current = true;
            }}
          />
        </>
      )}
    </div>
  );
}
