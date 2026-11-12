'use client';

import type { FC } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTranslations } from 'use-intl';

import { APP_ROUTES } from '@/common/constants';
import { cn } from '@/lib/utils';

const FINANCE_PAGES = [
  { name: 'overview', path: APP_ROUTES.Protected.Finances },
  { name: 'bills', path: APP_ROUTES.Protected.FinanceBills },
  { name: 'installments', path: APP_ROUTES.Protected.FinanceInstallments },
  { name: 'recurring', path: APP_ROUTES.Protected.FinanceRecurring },
  { name: 'calendar', path: APP_ROUTES.Protected.FinanceCalendar },
  { name: 'reports', path: APP_ROUTES.Protected.FinanceReports }
] as const;

export const FinanceNavigation: FC = () => {
  const t = useTranslations('finances.navigation');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('label')}
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-1 border-b sm:w-auto">
        {FINANCE_PAGES.map(({ name, path }) => {
          const isCurrent = pathname === path;

          return (
            <li key={path}>
              <Link
                href={path}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors ring-offset-background hover:text-foreground focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:h-10',
                  isCurrent && 'border-primary text-foreground'
                )}
              >
                {t(name)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
