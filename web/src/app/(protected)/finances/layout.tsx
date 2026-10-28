import type { Metadata } from 'next';

import { APP_TITLE_TEMPLATE } from '@/common/constants';
import type { Children } from '@/types';

import { FinanceNavigation } from './_components/finance-navigation';

export const metadata: Metadata = {
  title: { default: 'Finances', template: APP_TITLE_TEMPLATE }
};

export default function Layout({ children }: Children) {
  return (
    <div className="space-y-6">
      <FinanceNavigation />

      {children}
    </div>
  );
}
