'use client';

import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { usePrimaryPortfolio } from '@/hooks/use-portfolio';

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
  } = usePrimaryPortfolio();

  return (
    <div className="space-y-6 px-3 py-8 sm:px-4">
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
          className="h-64 rounded-3xl"
        />
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
        <>
          <PortfolioValueCard portfolio={portfolio} />

          <PerformanceChart portfolio={portfolio} />

          <div className="grid gap-6 xl:grid-cols-3">
            <AllocationChart portfolio={portfolio} />

            <PositionsSummary portfolio={portfolio} className="xl:col-span-2" />
          </div>

          <RecentTransactions portfolio={portfolio} />
        </>
      )}
    </div>
  );
}
