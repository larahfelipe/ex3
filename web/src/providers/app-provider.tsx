'use client';

import { Suspense, type FC, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { IoRefresh } from 'react-icons/io5';

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
  resetErrorBoundary?: () => void;
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
    <main className="h-screen">
      <div className="flex flex-col justify-center gap-4">
        <h4>Oops, something went wrong</h4>

        <Button aria-label="Reset" onClick={() => resetErrorBoundary!()}>
          <div className="flex items-center gap-2">
            <IoRefresh size={16} />

            <span>Try again</span>
          </div>
        </Button>
      </div>
    </main>
  );
};

export const AppProvider: FC<Readonly<Children>> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} />

    <Toaster richColors />

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
