'use client';

import type { FC } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_ROUTES } from '@/common/constants';
import { cn } from '@/lib/utils';

const FINANCE_PAGES = [
  { name: 'Overview', path: APP_ROUTES.Protected.Finances },
  { name: 'Bills', path: APP_ROUTES.Protected.FinanceBills },
  { name: 'Installments', path: APP_ROUTES.Protected.FinanceInstallments },
  { name: 'Recurring', path: APP_ROUTES.Protected.FinanceRecurring },
  { name: 'Calendar', path: APP_ROUTES.Protected.FinanceCalendar },
  { name: 'Reports', path: APP_ROUTES.Protected.FinanceReports }
];

export const FinanceNavigation: FC = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Finances"
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
                  '-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors ring-offset-background hover:text-foreground focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                  isCurrent && 'border-primary text-foreground'
                )}
              >
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
