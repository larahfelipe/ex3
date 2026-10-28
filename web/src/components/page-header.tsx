import type { FC, ReactNode } from 'react';

import { Skeleton } from '@/components/ui';

type PageHeaderProps = Record<'title', string> &
  Partial<Record<'description', string>> &
  Partial<Record<'isPending', boolean>> &
  Partial<Record<'action' | 'navigation', ReactNode>>;

export const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  isPending,
  action,
  navigation
}) => (
  <header className="space-y-3">
    {navigation}

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-bold wrap-anywhere">{title}</h1>

        {isPending && <Skeleton className="h-5 w-48 max-w-full" />}

        {description !== undefined && (
          <p className="text-sm text-muted-foreground wrap-anywhere">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  </header>
);
