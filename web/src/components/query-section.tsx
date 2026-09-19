import { useId, type ReactNode } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';
import { twMerge } from 'tailwind-merge';

import { ErrorState } from '@/components/data-state';
import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui';
import type { ApiProxyErrorData } from '@/lib/axios';

type QuerySectionProps<Content> = {
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

export const QuerySection = <Content,>({
  title,
  action,
  className,
  query,
  errorMessage,
  loading,
  empty,
  isEmpty,
  children
}: QuerySectionProps<Content>) => {
  const headingId = useId();
  const { data, isError, refetch } = query;

  const isLoading = data === undefined && !isError;

  return (
    <section
      aria-labelledby={headingId}
      className={twMerge('min-w-0', className)}
    >
      <Card className="h-full shadow-none">
        <SectionHeader id={headingId} title={title} action={action} />

        <CardContent aria-busy={isLoading}>
          {isLoading && loading}

          {data === undefined && isError && (
            <ErrorState message={errorMessage} onRetry={refetch} />
          )}

          {data !== undefined && (isEmpty(data) ? empty : children(data))}
        </CardContent>
      </Card>
    </section>
  );
};
