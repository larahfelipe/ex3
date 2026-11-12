import { Wordmark } from '@/components/wordmark';
import type { Children } from '@/types';

import { SessionCacheDisposal } from './_components/session-cache-disposal';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <SessionCacheDisposal />

      <div className="relative isolate flex min-h-dvh flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 -scale-y-100 bg-brand-glow mask-t-from-0% lg:hidden"
        />

        <header className="max-lg:mx-auto max-lg:w-full max-lg:max-w-100">
          <p className="text-center text-[clamp(3rem,14vw,4rem)] leading-none tracking-tighter text-foreground/40 lg:sr-only">
            <Wordmark />
          </p>
        </header>

        <main className="m-auto w-full max-w-100 space-y-6 py-12 duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2">
          {children}
        </main>
      </div>

      <div
        aria-hidden="true"
        className="relative m-3 flex items-end overflow-hidden rounded-[1.75rem] bg-brand-glow p-12 after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-foreground/10 after:ring-inset max-lg:hidden lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:self-start"
      >
        <p className="text-[clamp(5rem,10vw,10rem)] leading-none tracking-tighter text-foreground/40 select-none">
          <Wordmark />
        </p>

        <div className="absolute inset-0 bg-grain opacity-30 mix-blend-overlay" />
      </div>
    </div>
  );
}
