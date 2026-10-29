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
import { useTranslations } from 'use-intl';

import { Toaster } from '@/components/toaster';
import { Button } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/catalog';
import { queryClient } from '@/lib/react-query';
import type { Children } from '@/types';

import { LocaleProvider } from './locale-provider';

type AppProviderProps = Children &
  Record<'locale', Locale> &
  Record<'messages', Messages>;

type FallbackContentProps = {
  error?: unknown;
  resetErrorBoundary?: VoidFunction;
};

const FallbackContent: FC<FallbackContentProps> = ({
  error,
  resetErrorBoundary
}) => {
  const t = useTranslations('common');

  if (!error)
    return (
      <main className="h-lvh flex">
        <output className="m-auto">
          <span className="sr-only">{t('states.loading')}</span>

          <Loader2 aria-hidden="true" className="size-6 animate-spin" />
        </output>
      </main>
    );

  return (
    <main className="h-screen flex">
      <div className="flex flex-col justify-center gap-4 m-auto">
        <h1 className="text-lg font-semibold">{t('fallback.title')}</h1>

        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => resetErrorBoundary!()}
        >
          <RefreshCw size={16} aria-hidden="true" />

          <span>{t('fallback.retry')}</span>
        </Button>
      </div>
    </main>
  );
};

/**
 * The catalog arrives from the server layout, so only the locale it renders in
 * is sent; the handlers stay on the client because a function cannot cross
 * that edge.
 */
export const AppProvider: FC<AppProviderProps> = ({
  locale,
  messages,
  children
}) => (
  <LocaleProvider locale={locale} messages={messages}>
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
  </LocaleProvider>
);
