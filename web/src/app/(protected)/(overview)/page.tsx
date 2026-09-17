'use client';

import { LoadErrorAlert } from '@/components/load-error-alert';
import { Skeleton } from '@/components/ui';
import { usePrimaryPortfolio } from '@/hooks/use-portfolio';

import { AllocationChart } from './_components/allocation-chart';
import { PerformanceChart } from './_components/performance-chart';
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
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold">Overview</h1>

        {isPending && <Skeleton className="h-5 w-48" />}

        {portfolio && (
          <p className="text-sm text-muted-foreground">
            {`${portfolio.name} · Base currency ${portfolio.baseCurrency}`}
          </p>
        )}
      </header>

      {isPending && (
        <div aria-busy="true">
          <Skeleton className="h-64 w-full rounded-3xl" />
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
