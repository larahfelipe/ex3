import type { FC, ReactNode } from 'react';

import { CardHeader } from '@/components/ui';

type SectionHeaderProps = Record<'id' | 'title', string> &
  Partial<Record<'description', string>> &
  Partial<Record<'action', ReactNode>>;

export const SectionHeader: FC<SectionHeaderProps> = ({
  id,
  title,
  description,
  action
}) => (
  <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
    <div className="min-w-0 space-y-1.5">
      <h2 id={id} className="text-lg font-semibold leading-none tracking-tight">
        {title}
      </h2>

      {description !== undefined && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>

    {action}
  </CardHeader>
);
