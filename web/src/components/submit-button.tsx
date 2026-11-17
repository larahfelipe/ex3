import type { FC, ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui';
import { cn } from '@/lib/utils';

type SubmitButtonProps = Pick<
  ButtonProps,
  'form' | 'size' | 'variant' | 'disabled' | 'className' | 'aria-describedby'
> &
  Record<'isPending', boolean> &
  Record<'children', ReactNode>;

export const SubmitButton: FC<SubmitButtonProps> = ({
  isPending,
  className,
  children,
  ...props
}) => (
  <Button
    {...props}
    type="submit"
    aria-disabled={isPending}
    className={cn('gap-2', className)}
    onClick={(event) => {
      if (isPending) event.preventDefault();
    }}
  >
    {isPending && (
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
    )}

    <span>{children}</span>
  </Button>
);
