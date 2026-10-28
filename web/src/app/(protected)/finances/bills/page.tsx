import type { Metadata } from 'next';

import { BillsView } from '../_components/bills-view';

export const metadata: Metadata = {
  title: 'Bills'
};

export default function Page() {
  return <BillsView />;
}
