import type { Metadata } from 'next';

import { RecurringView } from '../_components/recurring-view';

export const metadata: Metadata = {
  title: 'Recurring expenses'
};

export default function Page() {
  return <RecurringView />;
}
