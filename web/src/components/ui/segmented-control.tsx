import * as React from 'react';

import { cn } from '@/lib/utils';

const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex rounded-md border border-input p-0.5 in-data-invalid:border-negative',
      className
    )}
    {...props}
  />
));
SegmentedControl.displayName = 'SegmentedControl';

const SegmentedControlItem = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, children, ...props }, ref) => (
  <label
    className={cn('cursor-pointer has-disabled:cursor-not-allowed', className)}
  >
    <input ref={ref} type="radio" className="peer sr-only" {...props} />

    <span className="block rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50">
      {children}
    </span>
  </label>
));
SegmentedControlItem.displayName = 'SegmentedControlItem';

export { SegmentedControl, SegmentedControlItem };
