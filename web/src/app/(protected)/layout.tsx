'use client';

import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

const MAIN_CONTENT_ID = 'main-content';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-elevated focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-focus"
      >
        Skip to content
      </a>

      <Sidebar />

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="focus:outline-none max-sm:pb-(--navigation-bar) sm:ml-(--navigation-rail)"
      >
        {children}
      </main>
    </div>
  );
}
