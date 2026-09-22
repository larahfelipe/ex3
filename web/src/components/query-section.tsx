import { useEffect, useId, useRef, type ReactNode } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';
import { twMerge } from 'tailwind-merge';

import {
  ErrorState,
  STALE_DATA_MESSAGE,
  StaleState
} from '@/components/data-state';
import { SectionHeader } from '@/components/section-header';
import { Card, CardContent } from '@/components/ui';
import type { ApiProxyErrorData } from '@/lib/axios';

type QuerySectionProps<Content> = {
  title: string;
  action?: ReactNode;
  className?: string;
  query: Pick<
    UseQueryResult<Content, ApiProxyErrorData>,
    'data' | 'isError' | 'isRefetchError' | 'isFetching' | 'refetch'
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasFocusWithin = useRef(false);
  const { data, isError, isRefetchError, isFetching, refetch } = query;

  const isLoading = data === undefined && !isError;
  const shownContent = data !== undefined && !isEmpty(data) ? data : undefined;
  const previousShownContent = useRef(shownContent);

  /**
   * Content that replaces the focused element, such as the empty state after
   * deleting the last row, drops focus to `<body>`. Focus events bubble through
   * portals in the React tree, so a dialog opened from this section still
   * counts as focus within it.
   */
  useEffect(() => {
    const previous = previousShownContent.current;
    previousShownContent.current = shownContent;

    if (previous === undefined || previous === shownContent) return;
    if (!hasFocusWithin.current) return;
    if (
      document.activeElement !== null &&
      document.activeElement !== document.body
    )
      return;

    headingRef.current?.focus();
  }, [shownContent]);

  return (
    <section
      aria-labelledby={headingId}
      className={twMerge('min-w-0', className)}
      onFocus={() => {
        hasFocusWithin.current = true;
      }}
      onBlur={({ relatedTarget }) => {
        if (relatedTarget !== null) hasFocusWithin.current = false;
      }}
    >
      <Card className="h-full shadow-none">
        <SectionHeader
          ref={headingRef}
          id={headingId}
          title={title}
          action={action}
        />

        <CardContent aria-busy={isLoading}>
          {isRefetchError && (
            <div className="mb-4">
              <StaleState
                message={STALE_DATA_MESSAGE}
                isRetrying={isFetching}
                onRetry={refetch}
              />
            </div>
          )}

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
