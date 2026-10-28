import type { Metadata } from 'next';

import { ReportsView } from '../_components/reports-view';

export const metadata: Metadata = {
  title: 'Finance reports'
};

export default function Page() {
  return <ReportsView />;
}
