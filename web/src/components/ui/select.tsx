'use client';

import * as React from 'react';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useNonce } from '@/providers/nonce-provider';

import { FIELD_CLASS } from './field';

const Select = SelectPrimitive.Root;

const SelectValue = SelectPrimitive.Value;

const UnstyledSelectTrigger = SelectPrimitive.Trigger;

const SELECT_TRIGGER_CLASS = cn(
  FIELD_CLASS,
  'flex h-(--field-height) w-full items-center justify-between px-3 py-2 text-base data-placeholder:text-muted-foreground md:text-sm [&>span]:line-clamp-1'
);

const SELECT_ITEM_CLASS =
  'relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 pl-2 pr-8 text-sm outline-hidden sm:py-1.5 focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50';

const SelectTrigger = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) => (
  <SelectPrimitive.Trigger
    className={cn(SELECT_TRIGGER_CLASS, className)}
    {...props}
  >
    {children}

    <SelectPrimitive.Icon asChild>
      <ChevronsUpDown className="size-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);

/** The viewport hides its scrollbar with a `<style>`, which needs the page's nonce. */
const SelectContent = ({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) => {
  const nonce = useNonce();

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-elevated data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport
          nonce={nonce}
          className={cn(
            'popover-list p-1',
            position === 'popper' &&
              'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
};

const SelectItem = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) => (
  <SelectPrimitive.Item className={cn(SELECT_ITEM_CLASS, className)} {...props}>
    <span className="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);

export {
  Select,
  SELECT_ITEM_CLASS,
  SELECT_TRIGGER_CLASS,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UnstyledSelectTrigger
};
