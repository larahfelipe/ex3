import { useState, type FC } from 'react';

import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { Button } from '@/components/ui';
import { useRefreshPortfolio } from '@/hooks/use-portfolio';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

type RefreshPortfolioButtonProps = {
  portfolio: Maybe<Portfolio>;
  className?: string;
};

export const RefreshPortfolioButton: FC<RefreshPortfolioButtonProps> = ({
  portfolio,
  className
}) => {
  const refreshPortfolio = useRefreshPortfolio(portfolio);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const t = useTranslations('common.actions');
  const tRefresh = useTranslations('investments.refresh');

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-2', className)}
      aria-disabled={isRefreshing}
      onClick={async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        const outcome = await refreshPortfolio({ cancelRefetch: false });
        setIsRefreshing(false);

        if (outcome === 'failed') toast.error(tRefresh('failed'));
        else if (outcome === 'degraded')
          toast.warning(tRefresh('degraded'), {
            description: tRefresh('degradedDescription')
          });
        else
          toast.success(tRefresh('done'), {
            description: tRefresh('doneDescription')
          });
      }}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn('size-4', isRefreshing && 'animate-spin')}
      />

      {t('refresh')}
    </Button>
  );
};
