import type { Metadata } from 'next';

import { APP_TITLE_TEMPLATE } from '@/common/constants';
import { getServerTranslator } from '@/i18n/server';
import type { Children } from '@/types';

import { FinanceNavigation } from './_components/finance-navigation';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: {
    default: (await getServerTranslator('navigation.pages'))('finances'),
    template: APP_TITLE_TEMPLATE
  }
});

export default function Layout({ children }: Children) {
  return (
    <div className="space-y-6">
      <FinanceNavigation />

      {children}
    </div>
  );
}
