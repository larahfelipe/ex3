import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';

import { InstallmentsView } from '../_components/installments-view';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('installments')
});

export default function Page() {
  return <InstallmentsView />;
}
