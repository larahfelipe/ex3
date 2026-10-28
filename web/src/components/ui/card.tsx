import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'rounded-2xl border bg-surface text-surface-foreground shadow-surface',
      className
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn('flex items-center px-5 pb-5 sm:px-6 sm:pb-6', className)}
    {...props}
  />
);

export { Card, CardContent, CardFooter, CardHeader };
