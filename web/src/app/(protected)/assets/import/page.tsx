'use client';

import Link from 'next/link';

import { ArrowLeft, Wallet } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { APP_ROUTES } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/use-portfolio';

import { ImportWorkspace } from './_components/import-workspace';

export default function AssetImport() {
  const t = useTranslations('imports');
  const tOverview = useTranslations('investments.overview');
  const tNavigation = useTranslations('navigation.pages');

  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = useActivePortfolio();

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNavigation('assetImport')}
        isPending={isPending}
        description={
          portfolio ? t('description', { name: portfolio.name }) : undefined
        }
        navigation={
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto gap-1.5 p-0 text-muted-foreground"
          >
            <Link href={APP_ROUTES.Protected.Assets}>
              <ArrowLeft aria-hidden="true" className="size-4" />

              {t('back')}
            </Link>
          </Button>
        }
      />

      {isPending && (
        <LoadingState label={tOverview('loading')} className="h-96" />
      )}

      {isError && !portfolio && (
        <ErrorState message={tOverview('loadFailed')} onRetry={refetch} />
      )}

      {isSuccess && !portfolio && (
        <EmptyState
          icon={Wallet}
          title={tOverview('noPortfolioTitle')}
          message={tOverview('noPortfolio')}
          action={{
            label: tOverview('createPortfolio'),
            href: APP_ROUTES.Protected.Portfolios
          }}
        />
      )}

      {/* A preview plans the file against one portfolio, so switching starts over. */}
      {portfolio && (
        <ImportWorkspace key={portfolio.id} portfolio={portfolio} />
      )}
    </div>
  );
}
