'use client';

import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="max-sm:pb-(--navigation-bar) sm:ml-(--navigation-rail)">
        {children}
      </main>
    </div>
  );
}
