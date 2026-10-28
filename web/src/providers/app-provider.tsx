'use client';

import { Suspense, type FC } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { AppProgressBar } from 'next-nprogress-bar';

import {
  QueryClientProvider,
  QueryErrorResetBoundary
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Loader2, RefreshCw } from 'lucide-react';

import { Toaster } from '@/components/toaster';
import { Button } from '@/components/ui';
import { queryClient } from '@/lib/react-query';
import type { Children } from '@/types';

type FallbackContentProps = {
  error?: unknown;
  resetErrorBoundary?: VoidFunction;
};

const FallbackContent: FC<FallbackContentProps> = ({
  error,
  resetErrorBoundary
}) => {
  if (!error)
    return (
      <main className="h-lvh flex">
        <output className="m-auto">
          <span className="sr-only">Loading</span>

          <Loader2 aria-hidden="true" className="size-6 animate-spin" />
        </output>
      </main>
    );

  return (
    <main className="h-screen flex">
      <div className="flex flex-col justify-center gap-4 m-auto">
        <h1 className="text-lg font-semibold">Oops, something went wrong</h1>

        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => resetErrorBoundary!()}
        >
          <RefreshCw size={16} aria-hidden="true" />

          <span>Try again</span>
        </Button>
      </div>
    </main>
  );
};

export const AppProvider: FC<Children> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />

    <AppProgressBar
      shallowRouting
      height="3px"
      color="hsl(var(--primary))"
      options={{ showSpinner: false }}
    />

    <Toaster />

    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={(props) => <FallbackContent {...props} />}
        >
          <Suspense fallback={<FallbackContent />}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  </QueryClientProvider>
);
