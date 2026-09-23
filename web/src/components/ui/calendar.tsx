'use client';

import * as React from 'react';
import {
  DayPicker,
  getDefaultClassNames,
  useDayPicker,
  type ChevronProps,
  type DropdownProps
} from 'react-day-picker';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp
} from 'lucide-react';

import {
  formatShortMonth,
  startOfMonthInYear,
  startOfMonthNumbered
} from '@/lib/dates';
import { cn } from '@/lib/utils';

import { buttonVariants } from './button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select';

/** The dropdowns move the calendar from the month it shows, so it shows one at a time. */
type CalendarProps = React.ComponentProps<typeof DayPicker> &
  Partial<Record<'numberOfMonths', 1>>;

type CalendarDropdownProps = DropdownProps & {
  onValueChange: (value: number) => void;
};

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

/**
 * The month and the year are picked from the themed Select instead of the
 * native `<select>`, whose list the browser draws in its own colors.
 */
const CalendarDropdown = ({
  options = [],
  value,
  disabled,
  'aria-label': label,
  onValueChange
}: CalendarDropdownProps) => {
  const selected = options.find((option) => option.value === value);

  return (
    <Select
      disabled={disabled}
      value={selected === undefined ? undefined : String(selected.value)}
      onValueChange={(chosen) => onValueChange(Number(chosen))}
    >
      <SelectTrigger
        aria-label={label}
        className="h-8 w-auto gap-1 border-transparent px-2 font-medium hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent className="max-h-64">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const CalendarMonthsDropdown = (props: DropdownProps) => {
  const { months, goToMonth } = useDayPicker();

  return (
    <CalendarDropdown
      {...props}
      onValueChange={(month) =>
        goToMonth(startOfMonthNumbered(months[0].date, month))
      }
    />
  );
};

const CalendarYearsDropdown = (props: DropdownProps) => {
  const { months, goToMonth } = useDayPicker();

  return (
    <CalendarDropdown
      {...props}
      onValueChange={(year) =>
        goToMonth(startOfMonthInYear(months[0].date, year))
      }
    />
  );
};

const Calendar = ({
  className,
  classNames,
  formatters,
  showOutsideDays = true,
  ...props
}: CalendarProps) => {
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
        dropdowns: 'flex items-center gap-1',
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
      formatters={{ formatMonthDropdown: formatShortMonth, ...formatters }}
      components={{
        Chevron: CalendarChevron,
        MonthsDropdown: CalendarMonthsDropdown,
        YearsDropdown: CalendarYearsDropdown
      }}
      {...props}
    />
  );
};

export { Calendar };
