'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button, type ButtonProps } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

type IconButtonProps = Omit<ButtonProps, 'asChild' | 'children' | 'size'> &
  Record<'label', string> &
  Record<'icon', LucideIcon> &
  Partial<Record<'size', 'icon' | 'icon-sm'>>;

const IconButton = ({
  label,
  icon: Icon,
  variant = 'ghost',
  size = 'icon-sm',
  className,
  'aria-label': ariaLabel = label,
  ...props
}: IconButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        className={cn('shrink-0', className)}
        {...props}
      >
        <Icon size={16} aria-hidden="true" />
      </Button>
    </TooltipTrigger>

    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export { IconButton };
