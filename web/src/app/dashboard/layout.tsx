import type { Metadata } from 'next';

import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

export const metadata: Metadata = {
  title: 'EX3 | Dashboard'
};

export default function Layout({ children }: Readonly<Children>) {
  return (
    <div className="grid grid-cols-[200px_auto]">
      <Sidebar />

      {children}
    </div>
  );
}
