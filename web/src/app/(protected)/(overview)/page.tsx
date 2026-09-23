'use client';

import { APP_ROUTES } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { useActivePortfolio } from '@/hooks/use-portfolio';

import { AllocationChart } from './_components/allocation-chart';
import { PortfolioValueCard } from './_components/portfolio-value-card';
import { PositionsSummary } from './_components/positions-summary';
import { RecentTransactions } from './_components/recent-transactions';

export default function Overview() {
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
        title="Overview"
        isPending={isPending}
        description={
          portfolio
            ? `${portfolio.name} · Base currency ${portfolio.baseCurrency}`
            : undefined
        }
      />

      {isPending && (
        <LoadingState
          label="Loading your portfolio"
          className="h-64 rounded-2xl"
        />
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
          <PortfolioValueCard portfolio={portfolio} />

          <PerformanceChart portfolio={portfolio} />

          <div className="grid gap-6 lg:grid-cols-3">
            <AllocationChart portfolio={portfolio} />

            <PositionsSummary portfolio={portfolio} className="lg:col-span-2" />
          </div>

          <RecentTransactions portfolio={portfolio} />
        </>
      )}
    </div>
  );
}
