import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';

import { CalendarView } from '../_components/calendar-view';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('calendar')
});

export default function Page() {
  return <CalendarView />;
}
