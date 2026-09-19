'use client';

import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

export default function Layout({ children }: Children) {
  return (
    <div className="h-full flex flex-col bg-background sm:grid">
      <Sidebar />

      <main className="sm:ml-(--navigation-rail)">{children}</main>
    </div>
  );
}
