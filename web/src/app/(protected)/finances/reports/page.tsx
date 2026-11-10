import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';

import { ReportsView } from '../_components/reports-view';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('reports')
});

export default function Page() {
  return <ReportsView />;
}
