import type { FC } from 'react';

import { twMerge } from 'tailwind-merge';

import type { Children } from '@/types';

type DetailItemProps = Children &
  Record<'label', string> &
  Partial<Record<'className', string>>;

export const DetailItem: FC<DetailItemProps> = ({
  label,
  className,
  children
}) => (
  <div className={twMerge('min-w-0 space-y-1', className)}>
    <dt className="text-sm text-muted-foreground">{label}</dt>

    <dd className="font-medium wrap-anywhere">{children}</dd>
  </div>
);
