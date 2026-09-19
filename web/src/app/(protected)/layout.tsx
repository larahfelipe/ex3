'use client';

import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

export default function Layout({ children }: Children) {
  return (
    <main className="h-full flex flex-col bg-background sm:grid">
      <Sidebar />

      <div className="sm:ml-[160px]">{children}</div>
    </main>
  );
}
