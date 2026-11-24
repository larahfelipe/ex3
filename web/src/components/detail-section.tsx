import { useId, type FC, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const SUMMARY_PANEL_CLASS =
  'grid gap-x-6 gap-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5';

export const SUMMARY_VALUE_CLASS =
  'text-2xl font-semibold tracking-tight tabular-nums';

export const SUMMARY_DETAIL_CLASS =
  'mt-0.5 block text-sm font-normal tracking-normal text-muted-foreground';

export const FACT_LIST_CLASS = 'grid gap-x-6 gap-y-4 sm:grid-cols-2';

export const FACT_VALUE_CLASS = 'text-sm';

type DetailSectionProps = Record<'title' | 'children', ReactNode> &
  Partial<Record<'action', ReactNode>> &
  Partial<Record<'className', string>>;

export const DetailSection: FC<DetailSectionProps> = ({
  title,
  action,
  className,
  children
}) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn('min-w-0 space-y-3 border-t pt-5', className)}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {title}
        </h3>

        {action}
      </div>

      {children}
    </section>
  );
};
