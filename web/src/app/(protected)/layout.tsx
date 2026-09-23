import { cookies } from 'next/headers';

import { APP_STORAGE_KEYS, NAVIGATION_STATES } from '@/common/constants';
import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

const MAIN_CONTENT_ID = 'main-content';

export default async function Layout({ children }: Children) {
  const storedNavigationState = (await cookies()).get(
    APP_STORAGE_KEYS.Navigation
  )?.value;

  return (
    <div className="min-h-screen bg-background sm:flex">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-elevated focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-focus"
      >
        Skip to content
      </a>

      <Sidebar
        initialState={
          storedNavigationState === NAVIGATION_STATES.Collapsed
            ? NAVIGATION_STATES.Collapsed
            : NAVIGATION_STATES.Expanded
        }
      />

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="min-w-0 flex-1 focus:outline-hidden max-sm:pb-(--navigation-bar)"
      >
        <div className="mx-auto w-full max-w-(--breakpoint-2xl) px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
