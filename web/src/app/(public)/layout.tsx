import { APP_TITLE } from '@/common/constants';
import type { Children } from '@/types';

import { SessionCacheDisposal } from './_components/session-cache-disposal';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <SessionCacheDisposal />

      <div className="relative isolate flex min-h-dvh flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-brand-glow opacity-30 mask-b-from-0% lg:hidden"
        />

        <header>
          <p className="font-display text-xl font-bold tracking-tight lg:sr-only">
            {APP_TITLE}
          </p>
        </header>

        <main className="m-auto w-full max-w-100 space-y-8 py-12 duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2">
          {children}
        </main>
      </div>

      <div
        aria-hidden="true"
        className="m-3 flex items-end rounded-[1.75rem] bg-brand-glow p-12 max-lg:hidden lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:self-start"
      >
        <p className="font-display text-[clamp(5rem,10vw,10rem)] leading-none font-bold tracking-tighter text-foreground/75 mix-blend-soft-light select-none">
          {APP_TITLE}
        </p>
      </div>
    </div>
  );
}
