import type { Metadata } from 'next';

import { InstallmentsView } from '../_components/installments-view';

export const metadata: Metadata = {
  title: 'Installments'
};

export default function Page() {
  return <InstallmentsView />;
}
