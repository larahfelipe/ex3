import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';

import { RecurringView } from '../_components/recurring-view';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('recurring')
});

export default function Page() {
  return <RecurringView />;
}
