'use client';

import { Suspense, type FC, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  IoCheckmarkCircleOutline,
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
import { UserProvider } from '@/providers/user-provider';
import type { Children } from '@/types';

type FallbackContentProps = {
  error?: ReactNode;
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
      icons={{
        error: <MdOutlineErrorOutline size={26} className="text-red-500" />,
        success: (
          <IoCheckmarkCircleOutline size={26} className="text-emerald-500" />
        ),
        warning: <IoWarningOutline size={26} className="text-yellow-500" />
      }}
      toastOptions={{
        style: {
          height: '64px',
          borderTop: '#0F0F0F',
          borderLeft: '#0F0F0F',
          borderRight: '#0F0F0F',
          backgroundColor: '#0F0F0F'
        },
        classNames: {
          icon: 'w-[32px] h-[32px]',
          title: 'text-[14px] text-white',
          error: 'border-b-[3px] border-b-red-500',
          success: 'border-b-[3px] border-b-emerald-500',
          warning: 'border-b-[3px] border-b-yellow-500'
        }
      }}
    />

    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={(props) => <FallbackContent {...props} />}
        >
          <Suspense fallback={<FallbackContent />}>
            <UserProvider>{children}</UserProvider>
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  </QueryClientProvider>
);
