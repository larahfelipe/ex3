'use client';

import { useRef, useState } from 'react';

import { Plus, Wallet } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { APP_ROUTES } from '@/common/constants';
import { AssetDialogs, type AssetDialog } from '@/components/asset-dialogs';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { Button } from '@/components/ui';
import { usePageParam } from '@/hooks/use-page-param';
import { useActivePortfolio } from '@/hooks/use-portfolio';
import { useTransactions } from '@/hooks/use-transactions';
import { FIRST_PAGE } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

import { AllocationChart } from './_components/allocation-chart';
import {
  GettingStarted,
  useGettingStartedDismissal,
  useGettingStartedStage
} from './_components/getting-started';
import { IncomeSummary } from './_components/income-summary';
import { PortfolioSwitcher } from './_components/portfolio-switcher';
import { PortfolioValueCard } from './_components/portfolio-value-card';
import {
  POSITIONS_PAGE_PARAM,
  PositionsSummary
} from './_components/positions-summary';
import {
  RECENT_TRANSACTIONS_PAGE,
  RecentTransactions
} from './_components/recent-transactions';

export default function Overview() {
  const [assetDialog, setAssetDialog] = useState<Maybe<AssetDialog>>(null);
  const [isGuideDismissed, dismissGuide] = useGettingStartedDismissal();
  const addAssetButtonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations('investments.overview');
  const tNavigation = useTranslations('navigation.pages');
  const [positionsPage, goToPositionsPage] = usePageParam(POSITIONS_PAGE_PARAM);

  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = useActivePortfolio();

  const { data: recentTransactions } = useTransactions(
    portfolio,
    RECENT_TRANSACTIONS_PAGE
  );
  const guideStage = useGettingStartedStage(
    portfolio?.id,
    recentTransactions?.total,
    addAssetButtonRef
  );
  const isGuideShown =
    !isGuideDismissed &&
    (guideStage === 'open' ||
      guideStage === 'complete' ||
      guideStage === 'leaving');

  const openAddAssetDialog = () => setAssetDialog({ kind: 'add-asset' });

  // A page of the previous portfolio's positions means nothing in the next one.
  const resetPositionsPage = () => {
    if (positionsPage !== FIRST_PAGE) goToPositionsPage(FIRST_PAGE);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNavigation('overview')}
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
            <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
              <PortfolioSwitcher
                portfolio={portfolio}
                onSwitch={resetPositionsPage}
              />

              <Button
                ref={addAssetButtonRef}
                size="sm"
                className="gap-1.5 max-sm:w-full"
                onClick={openAddAssetDialog}
              >
                <Plus size={16} aria-hidden="true" />

                {t('addAsset')}
              </Button>
            </div>
          )
        }
      />

      {isPending && (
        <LoadingState label={t('loading')} className="h-64 rounded-2xl" />
      )}

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
          {isGuideShown ? (
            <GettingStarted
              portfolio={portfolio}
              isComplete={guideStage !== 'open'}
              isLeaving={guideStage === 'leaving'}
              onAddAsset={openAddAssetDialog}
              onDismiss={() => {
                addAssetButtonRef.current?.focus();
                dismissGuide();
              }}
              onRecordTransaction={(symbol) =>
                setAssetDialog({ kind: 'add-transaction', symbol })
              }
            />
          ) : (
            <div
              className={cn(
                'space-y-6',
                guideStage === 'revealed' &&
                  'animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out'
              )}
            >
              <PortfolioValueCard portfolio={portfolio} />

              <PerformanceChart portfolio={portfolio} />

              <div className="grid gap-6 lg:grid-cols-3">
                <AllocationChart portfolio={portfolio} />

                <PositionsSummary
                  portfolio={portfolio}
                  onAddAsset={openAddAssetDialog}
                  className="lg:col-span-2"
                />
              </div>

              <IncomeSummary portfolio={portfolio} />

              <RecentTransactions portfolio={portfolio} />
            </div>
          )}

          <AssetDialogs
            portfolio={portfolio}
            dialog={assetDialog}
            onDialogChange={setAssetDialog}
            offersTransaction={isGuideDismissed || guideStage !== 'open'}
          />
        </>
      )}
    </div>
  );
}
