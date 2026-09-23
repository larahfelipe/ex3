'use client';

import * as React from 'react';
import {
  DayPicker,
  getDefaultClassNames,
  type ChevronProps
} from 'react-day-picker';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { buttonVariants } from './button';

const CHEVRONS = {
  left: ChevronLeft,
  right: ChevronRight,
  up: ChevronUp,
  down: ChevronDown
} as const;

const CalendarChevron = ({ orientation = 'left', className }: ChevronProps) => {
  const Icon = CHEVRONS[orientation];

  return <Icon aria-hidden="true" className={cn('size-4', className)} />;
};

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) => {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('text-sm', className)}
      classNames={{
        root: defaultClassNames.root,
        months: 'relative flex flex-col gap-4',
        month: 'flex w-full flex-col gap-3',
        nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'size-9 aria-disabled:opacity-50'
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'size-9 aria-disabled:opacity-50'
        ),
        month_caption: 'flex h-9 items-center justify-center px-10',
        caption_label:
          'flex h-8 items-center gap-1 rounded-md px-2 font-medium',
        dropdowns: 'flex items-center gap-1.5 font-medium',
        dropdown_root:
          'relative rounded-md border border-input has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 ring-offset-background',
        dropdown: 'absolute inset-0 cursor-pointer opacity-0',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-9 text-center text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'size-9 p-0 text-center',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'size-9 font-normal tabular-nums'
        ),
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        today: '[&>button]:font-semibold [&>button]:underline',
        outside: 'text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames
      }}
      components={{ Chevron: CalendarChevron }}
      {...props}
    />
  );
};

export { Calendar };
