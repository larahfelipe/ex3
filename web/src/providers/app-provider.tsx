'use client';

import { Suspense, type CSSProperties, type FC } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  IoCheckmarkCircleOutline,
  IoInformationCircleOutline,
  IoRefresh,
  IoWarningOutline
} from 'react-icons/io5';
import { MdOutlineErrorOutline } from 'react-icons/md';

import { AppProgressBar } from 'next-nprogress-bar';

import {
  QueryClientProvider,
  QueryErrorResetBoundary
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

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
          <IoRefresh size={16} aria-hidden="true" />

          <span>Try again</span>
        </Button>
      </div>
    </main>
  );
};

export const AppProvider: FC<Children> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />

    <AppProgressBar
      shallowRouting
      height="3px"
      color="hsl(var(--primary))"
      options={{ showSpinner: false }}
    />

    <Toaster
      position="bottom-right"
      theme="dark"
      icons={{
        error: (
          <MdOutlineErrorOutline
            aria-hidden="true"
            size={22}
            className="text-negative"
          />
        ),
        success: (
          <IoCheckmarkCircleOutline
            aria-hidden="true"
            size={22}
            className="text-positive"
          />
        ),
        warning: (
          <IoWarningOutline
            aria-hidden="true"
            size={22}
            className="text-warning"
          />
        ),
        info: (
          <IoInformationCircleOutline
            aria-hidden="true"
            size={22}
            className="text-info"
          />
        )
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--surface-elevated))',
          '--normal-text': 'hsl(var(--surface-elevated-foreground))',
          '--normal-border': 'hsl(var(--border))'
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'items-start gap-3 border-l-4 shadow-elevated',
          icon: 'size-[22px] shrink-0',
          title: 'text-sm font-medium text-surface-elevated-foreground',
          description: 'text-sm text-surface-elevated-foreground/80',
          error: 'border-l-negative',
          success: 'border-l-positive',
          warning: 'border-l-warning',
          info: 'border-l-info'
        }
      }}
    />

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
