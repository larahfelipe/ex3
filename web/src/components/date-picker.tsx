import { useId, useState, type FC, type Ref } from 'react';

import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { FieldControlProps } from '@/components/form-field';
import {
  Button,
  Calendar,
  FIELD_CLASS,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui';
import { useFormat } from '@/i18n/format';
import {
  calendarDayOf,
  calendarDayOfDate,
  currentInstant,
  dateOfCalendarDay,
  shiftCalendarDayByMonths
} from '@/lib/dates';
import { cn } from '@/lib/utils';

export type DayBounds = Partial<Record<'min' | 'max', string>>;

type DatePickerProps = Omit<FieldControlProps, 'required'> &
  DayBounds & {
    ref?: Ref<HTMLButtonElement>;
    name?: string;
    value: string;
    onValueChange: (day: string) => void;
    onBlur?: VoidFunction;
  };

const OPEN_SIDE_MONTHS = 100 * 12;

const dateOf = (day: string | null | undefined) =>
  day === null || day === undefined ? undefined : dateOfCalendarDay(day);

export const calendarBoundsOf = (today: string, { min, max }: DayBounds) => {
  const before = dateOf(min);
  const after = dateOf(max);

  return {
    startMonth:
      before ?? dateOf(shiftCalendarDayByMonths(today, -OPEN_SIDE_MONTHS)),
    endMonth:
      after ?? dateOf(shiftCalendarDayByMonths(today, OPEN_SIDE_MONTHS)),
    disabled: [
      ...(before === undefined ? [] : [{ before }]),
      ...(after === undefined ? [] : [{ after }])
    ],
    isTodayAllowed:
      (min === undefined || today >= min) && (max === undefined || today <= max)
  };
};

export const DatePicker: FC<DatePickerProps> = ({
  id,
  ref,
  name,
  value,
  min,
  max,
  onValueChange,
  onBlur,
  'aria-invalid': isInvalid,
  'aria-describedby': describedBy
}) => {
  const valueId = useId();
  const t = useTranslations('common');
  const { formatCalendarDay } = useFormat();

  const [isOpen, setIsOpen] = useState(false);

  const today = calendarDayOf(currentInstant());
  const { isTodayAllowed, ...bounds } = calendarBoundsOf(today, { min, max });
  const selected = dateOfCalendarDay(value);
  const shownDay = formatCalendarDay(value);

  const choose = (day: string) => {
    onValueChange(day);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          ref={ref}
          name={name}
          type="button"
          variant="outline"
          aria-invalid={isInvalid}
          aria-describedby={[valueId, describedBy].filter(Boolean).join(' ')}
          className={cn(
            FIELD_CLASS,
            'h-(--field-height) w-full justify-start gap-2 px-3 font-normal hover:bg-background/60 motion-safe:active:scale-100',
            shownDay === null && 'text-muted-foreground'
          )}
          onBlur={onBlur}
        >
          <CalendarDays
            size={16}
            aria-hidden="true"
            className="shrink-0 opacity-50"
          />

          <span id={valueId}>{shownDay ?? t('form.datePlaceholder')}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto">
        <Calendar
          // eslint-disable-next-line jsx-a11y/no-autofocus -- DayPicker's prop, not the attribute: opening the calendar moves focus to the chosen day, as the APG date picker dialog does
          autoFocus
          required
          mode="single"
          captionLayout="dropdown"
          {...bounds}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => choose(calendarDayOfDate(date))}
        />

        <div className="mt-3 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={!isTodayAllowed}
            onClick={() => choose(today)}
          >
            {t('calendar.today')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
