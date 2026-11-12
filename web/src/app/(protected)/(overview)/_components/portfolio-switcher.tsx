import { useId, type FC } from 'react';

import Link from 'next/link';

import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type {
  GetPortfoliosRequestParams,
  Portfolio
} from '@/app/api/v1/portfolios';
import { APP_ROUTES } from '@/common/constants';
import { Label, SearchableSelect } from '@/components/ui';
import { selectActivePortfolio, usePortfolios } from '@/hooks/use-portfolio';
import { FIRST_PAGE } from '@/lib/pagination';

type PortfolioSwitcherProps = Record<'portfolio', Portfolio> &
  Partial<Record<'onSwitch', VoidFunction>>;

/** The API's largest page: an account rarely has more portfolios, and past it the list links to all of them. */
const SWITCHABLE_PORTFOLIOS: GetPortfoliosRequestParams = {
  page: FIRST_PAGE,
  limit: 100
};

/**
 * Switches the active portfolio in place. Every figure on the page is keyed by
 * the portfolio, so the new one loads its own instead of showing the previous
 * one's. With a single portfolio there is nothing to switch to, and nothing
 * is shown.
 */
export const PortfolioSwitcher: FC<PortfolioSwitcherProps> = ({
  portfolio,
  onSwitch
}) => {
  const selectId = useId();
  const t = useTranslations('investments.overview');
  const tPortfolios = useTranslations('portfolios');
  const { data } = usePortfolios(SWITCHABLE_PORTFOLIOS);

  if (data === undefined || data.pagination.total < 2) return null;

  const { portfolios, pagination } = data;
  const isActiveListed = portfolios.some(({ id }) => id === portfolio.id);
  const options = [...(isActiveListed ? [] : [portfolio]), ...portfolios].map(
    ({ id, name, baseCurrency }) => ({
      value: id,
      label: t('portfolioOption', { name, currency: baseCurrency })
    })
  );

  const switchTo = (portfolioId: string) => {
    const chosen = portfolios.find(({ id }) => id === portfolioId);

    if (chosen === undefined || chosen.id === portfolio.id) return;

    if (!selectActivePortfolio(chosen.id)) {
      toast.error(tPortfolios('storageBlocked'));
      return;
    }

    onSwitch?.();
    toast.success(tPortfolios('activated', { name: chosen.name }));
  };

  return (
    <div className="flex items-center gap-2 max-sm:w-full">
      <Label
        htmlFor={selectId}
        className="text-sm font-normal text-muted-foreground"
      >
        {t('portfolio')}
      </Label>

      <SearchableSelect
        id={selectId}
        value={portfolio.id}
        options={options}
        className="h-(--control-height) w-auto max-w-64 min-w-0 gap-2 max-sm:flex-1"
        onValueChange={switchTo}
      />

      {pagination.total > portfolios.length && (
        <Link
          href={APP_ROUTES.Protected.Portfolios}
          className="rounded-sm text-sm font-medium whitespace-nowrap text-muted-foreground underline-offset-4 ring-offset-background hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {t('allPortfolios')}
        </Link>
      )}
    </div>
  );
};
