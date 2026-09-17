import { useId, type ReactNode } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';
import { twMerge } from 'tailwind-merge';

import { LoadErrorAlert } from '@/components/load-error-alert';
import { Card, CardContent, CardHeader } from '@/components/ui';
import type { ApiProxyErrorData } from '@/lib/axios';

type OverviewSectionProps<Content> = {
  title: string;
  action?: ReactNode;
  className?: string;
  query: Pick<
    UseQueryResult<Content, ApiProxyErrorData>,
    'data' | 'isError' | 'refetch'
  >;
  errorMessage: string;
  loading: ReactNode;
  empty: ReactNode;
  isEmpty: (content: Content) => boolean;
  children: (content: Content) => ReactNode;
};

export const OverviewSection = <Content,>({
  title,
  action,
  className,
  query,
  errorMessage,
  loading,
  empty,
  isEmpty,
  children
}: OverviewSectionProps<Content>) => {
  const headingId = useId();
  const { data, isError, refetch } = query;

  const isLoading = data === undefined && !isError;

  return (
    <section
      aria-labelledby={headingId}
      className={twMerge('min-w-0', className)}
    >
      <Card className="h-full shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <h2
            id={headingId}
            className="text-lg font-semibold leading-none tracking-tight"
          >
            {title}
          </h2>

          {action}
        </CardHeader>

        <CardContent aria-busy={isLoading}>
          {isLoading && loading}

          {data === undefined && isError && (
            <LoadErrorAlert message={errorMessage} onRetry={refetch} />
          )}

          {data !== undefined && (isEmpty(data) ? empty : children(data))}
        </CardContent>
      </Card>
    </section>
  );
};
