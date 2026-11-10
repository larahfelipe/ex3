import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';

import { BillsView } from '../_components/bills-view';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('bills')
});

export default function Page() {
  return <BillsView />;
}
