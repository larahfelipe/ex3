import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-safe:active:scale-98',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        'destructive-subtle':
          'border border-destructive/25 bg-destructive/10 text-destructive hover:border-destructive/40 hover:bg-destructive/12 active:bg-destructive/14',
        success: 'bg-positive text-positive-foreground hover:bg-positive/90',
        outline:
          'border border-input bg-transparent hover:border-input-hover hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-(--control-height) px-4 py-2',
        sm: 'h-(--control-height) rounded-md px-3',
        xs: 'h-10 rounded-md px-2.5 sm:h-8',
        xxs: 'h-8 rounded-md px-2 sm:h-6',
        lg: 'h-(--field-height) rounded-md px-6',
        icon: 'size-(--control-height)'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> &
  Partial<Record<'asChild', boolean>>;

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};

export { Button, buttonVariants };
