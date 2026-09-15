import type { FC } from 'react';

import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { formatPercent } from '@/common/utils';
import { Skeleton } from '@/components/ui';
import { useAllocation } from '@/hooks/use-portfolio';

import { Amount, UnavailableValue } from './amounts';
import { OverviewSection } from './overview-section';

type AllocationSummaryProps = Record<'portfolio', Portfolio>;

const PERCENT_SCALE = 100;

const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  STOCK: 'Stocks',
  ETF: 'ETFs',
  FUND: 'Funds',
  REIT: 'REITs',
  CRYPTO: 'Crypto',
  BOND: 'Bonds',
  TREASURY: 'Treasuries',
  CASH: 'Cash',
  OTHER: 'Other'
};

export const AllocationSummary: FC<AllocationSummaryProps> = ({
  portfolio
}) => {
  const allocationQuery = useAllocation(portfolio);

  return (
    <OverviewSection
      title="Allocation"
      query={allocationQuery}
      errorMessage="The allocation could not be loaded"
      loading={<Skeleton className="h-40 w-full" />}
      isEmpty={({ byType }) => byType.length === 0}
      empty={
        <p className="text-sm text-muted-foreground">
          No allocation to display
        </p>
      }
    >
      {({ byType, baseCurrency }) => (
        <ul className="space-y-4">
          {byType.map(({ type, marketValue, allocation }) => (
            <li key={type} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">
                  {INSTRUMENT_TYPE_LABELS[type]}
                </span>

                <span className="flex items-baseline gap-2">
                  <span className="font-medium">
                    {allocation === undefined ? (
                      <UnavailableValue />
                    ) : (
                      formatPercent(allocation)
                    )}
                  </span>

                  <span className="text-xs text-muted-foreground">
                    <Amount amount={marketValue} currency={baseCurrency} />
                  </span>
                </span>
              </div>

              {allocation !== undefined && (
                <div
                  aria-hidden="true"
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Number(allocation) * PERCENT_SCALE}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </OverviewSection>
  );
};
