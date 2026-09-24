import { type FC, useState } from 'react';

import { RefreshCw } from 'lucide-react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { Button } from '@/components/ui';
import { useRefreshPortfolio } from '@/hooks/use-portfolio';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

type RefreshPortfolioButtonProps = {
  portfolio: Maybe<Portfolio>;
  className?: string;
};

/**
 * Refreshes every figure of the portfolio at once, so the page never shows a
 * value priced later than the rest. The refresh joins requests already running
 * instead of restarting them, and it ignores clicks until every request has
 * settled; a failure shows in the section it failed in.
 */
export const RefreshPortfolioButton: FC<RefreshPortfolioButtonProps> = ({
  portfolio,
  className
}) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2', className)}
      aria-disabled={isRefreshing}
      onClick={async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        await refreshPortfolio({ cancelRefetch: false });
        setIsRefreshing(false);
      }}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn('size-4', isRefreshing && 'animate-spin')}
      />
      Refresh
    </Button>
  );
};
