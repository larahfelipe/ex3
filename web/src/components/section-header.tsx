import type { FC, ReactNode, Ref } from 'react';

import { CardHeader } from '@/components/ui';

type SectionHeaderProps = Record<'id' | 'title', string> &
  Partial<Record<'description', string>> &
  Partial<Record<'action', ReactNode>> &
  Partial<Record<'ref', Ref<HTMLHeadingElement>>>;

export const SectionHeader: FC<SectionHeaderProps> = ({
  id,
  title,
  description,
  action,
  ref
}) => (
  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
    <div className="min-w-0 space-y-1.5">
      <h2
        ref={ref}
        id={id}
        tabIndex={-1}
        className="rounded-sm text-lg font-semibold leading-none tracking-tight ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        {title}
      </h2>

      {description !== undefined && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>

    {action}
  </CardHeader>
);
