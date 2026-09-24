import { useId, useState, type FC, type Ref } from 'react';

import { CalendarDays } from 'lucide-react';

import type { FieldControlProps } from '@/components/form-field';
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui';
import {
  calendarDayOfDate,
  dateOfCalendarDay,
  formatCalendarDay
} from '@/lib/dates';
import { cn } from '@/lib/utils';

type DatePickerProps = Omit<FieldControlProps, 'required'> & {
  ref?: Ref<HTMLButtonElement>;
  name?: string;
  /** A calendar day as `YYYY-MM-DD`, or empty. */
  value: string;
  onValueChange: (day: string) => void;
  onBlur?: VoidFunction;
};

const PLACEHOLDER = 'Pick a date';

/**
 * A label names a button in place of its content, so the chosen day, which
 * the button shows, also describes it for a screen reader.
 */
export const DatePicker: FC<DatePickerProps> = ({
  id,
  ref,
  name,
  value,
  onValueChange,
  onBlur,
  'aria-invalid': isInvalid,
  'aria-describedby': describedBy
}) => {
  const valueId = useId();

  const [isOpen, setIsOpen] = useState(false);

  const selected = dateOfCalendarDay(value);
  const shownDay = formatCalendarDay(value);

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
            'w-full justify-start gap-2 px-3 font-normal aria-invalid:border-negative',
            shownDay === null && 'text-muted-foreground'
          )}
          onBlur={onBlur}
        >
          <CalendarDays size={16} aria-hidden="true" />

          <span id={valueId}>{shownDay ?? PLACEHOLDER}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto">
        <Calendar
          // eslint-disable-next-line jsx-a11y/no-autofocus -- DayPicker's prop, not the attribute: opening the calendar moves focus to the chosen day, as the APG date picker dialog does
          autoFocus
          required
          mode="single"
          captionLayout="dropdown"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onValueChange(calendarDayOfDate(date));
            setIsOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
