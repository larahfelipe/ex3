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
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-screen flex">
      <div className="flex flex-col justify-center gap-4 m-auto">
        <h4>Oops, something went wrong</h4>

        <Button
          variant="secondary"
          aria-label="Reset"
          onClick={() => resetErrorBoundary!()}
        >
          <div className="flex items-center gap-2">
            <IoRefresh size={16} />

            <span>Try again</span>
          </div>
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
      color="#000"
      options={{ showSpinner: false }}
    />

    <Toaster
      position="bottom-right"
      theme="dark"
      icons={{
        error: <MdOutlineErrorOutline size={22} className="text-red-400" />,
        success: (
          <IoCheckmarkCircleOutline size={22} className="text-emerald-400" />
        ),
        warning: <IoWarningOutline size={22} className="text-amber-400" />,
        info: <IoInformationCircleOutline size={22} className="text-sky-400" />
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--popover))',
          '--normal-text': 'hsl(var(--popover-foreground))',
          '--normal-border': 'hsl(var(--border))'
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'items-start gap-3 border-l-4 shadow-lg',
          icon: 'size-[22px] shrink-0',
          title: 'text-sm font-medium text-popover-foreground',
          description: 'text-sm text-popover-foreground/80',
          error: 'border-l-red-400',
          success: 'border-l-emerald-400',
          warning: 'border-l-amber-400',
          info: 'border-l-sky-400'
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
