import type { ComponentProps, FC } from 'react';

import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';

export const InfoNote: FC<ComponentProps<'p'>> = ({
  className,
  children,
  ...props
}) => (
  <p
    className={cn(
      'flex items-start gap-2 text-sm text-muted-foreground',
      className
    )}
    {...props}
  >
    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

    <span>{children}</span>
  </p>
);
