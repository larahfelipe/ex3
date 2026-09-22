import type { FC, ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui';
import { cn } from '@/lib/utils';

type SubmitButtonProps = Pick<
  ButtonProps,
  'form' | 'size' | 'disabled' | 'className'
> &
  Record<'isPending', boolean> &
  Record<'children', ReactNode>;

/**
 * A pending submit stays focusable through `aria-disabled` and cancels its
 * click, which also cancels implicit submission from a field: disabling the
 * button that has focus drops that focus to `<body>`, and after a failed submit
 * the next Tab would start over from the top of the page.
 */
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
