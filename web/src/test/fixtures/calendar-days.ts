import { formatOf } from '@/i18n/format';
import {
  calendarDayOf,
  calendarDayOfDate,
  dateOfCalendarDay,
  daysBetween,
  daysOfCalendarMonth,
  instantOfCalendarDay,
  shiftCalendarDay
} from '@/lib/dates';

const {
  formatCalendarDay,
  formatCalendarMonth,
  formatLongCalendarMonth,
  formatLongWeekdayCalendarDay,
  formatSeriesDay,
  weekdayNames
} = formatOf('pt-BR');

const date = dateOfCalendarDay('2026-10-28');
const instant = instantOfCalendarDay('2026-10-28');

process.stdout.write(
  JSON.stringify({
    day: formatCalendarDay('2026-10-28'),
    newYear: formatCalendarDay('2026-01-01'),
    month: formatCalendarMonth('2026-10'),
    longMonth: formatLongCalendarMonth('2026-10'),
    weekday: formatLongWeekdayCalendarDay('2026-10-28'),
    seriesDay: formatSeriesDay('2026-10-28T00:00:00.000Z'),
    weekdays: weekdayNames('short'),
    roundTrip: date === undefined ? null : calendarDayOfDate(date),
    pickedDay: instant === null ? null : calendarDayOf(instant),
    pickedUtcDay: instant === null ? null : instant.slice(0, 10),
    acrossDst: daysBetween('2026-10-28', '2026-11-04'),
    nextDay: shiftCalendarDay('2026-10-31', 1),
    firstWeekday: daysOfCalendarMonth('2026-11')?.firstWeekday ?? null
  })
);
