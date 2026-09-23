import * as React from 'react';

import { cn } from '@/lib/utils';

const SegmentedControl = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'flex rounded-md border border-input p-0.5 in-data-invalid:border-negative',
      className
    )}
    {...props}
  />
);

const SegmentedControlItem = ({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) => (
  <label
    className={cn('cursor-pointer has-disabled:cursor-not-allowed', className)}
  >
    <input type="radio" className="peer sr-only" {...props} />

    <span className="block rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50">
      {children}
    </span>
  </label>
);

export { SegmentedControl, SegmentedControlItem };
