import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addMonths,
  daysInMonth,
  endOfMonth,
  formatCalendarDay,
  formatCalendarMonth,
  monthsBetween,
  parseCalendarDay,
  parseCalendarMonth,
  utcToday
} from './CalendarDay';

const day = (value: string) => {
  const parsed = parseCalendarDay(value);

  assert.ok(parsed, `${value} is a calendar day`);

  return parsed;
};

describe('parseCalendarDay', () => {
  it('reads a day as its UTC midnight', () => {
    assert.equal(day('2026-03-05').toISOString(), '2026-03-05T00:00:00.000Z');
  });

  it('accepts 29 February only in a leap year', () => {
    assert.equal(formatCalendarDay(day('2028-02-29')), '2028-02-29');
    assert.equal(parseCalendarDay('2026-02-29'), null);
    assert.equal(parseCalendarDay('2100-02-29'), null);
    assert.equal(formatCalendarDay(day('2000-02-29')), '2000-02-29');
  });

  it('refuses what is not a day of the calendar', () => {
    for (const value of [
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-1-5',
      '2026-01-05T00:00:00Z',
      ''
    ])
      assert.equal(parseCalendarDay(value), null, value);
  });
});

describe('parseCalendarMonth', () => {
  it('reads a month as its first day', () => {
    assert.equal(
      parseCalendarMonth('2026-02')?.toISOString(),
      '2026-02-01T00:00:00.000Z'
    );
  });

  it('refuses a month out of range', () => {
    assert.equal(parseCalendarMonth('2026-13'), null);
    assert.equal(parseCalendarMonth('2026-00'), null);
  });
});

describe('addMonths', () => {
  it('falls on the last day of a shorter month and returns to the anchor', () => {
    const start = day('2026-01-31');

    assert.deepEqual(
      [0, 1, 2, 3].map((months) => formatCalendarDay(addMonths(start, months))),
      ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']
    );
  });

  it('reaches 29 February in a leap year', () => {
    assert.equal(
      formatCalendarDay(addMonths(day('2028-01-30'), 1)),
      '2028-02-29'
    );
  });

  it('crosses the year in both directions', () => {
    assert.equal(
      formatCalendarDay(addMonths(day('2026-11-15'), 3)),
      '2027-02-15'
    );
    assert.equal(
      formatCalendarDay(addMonths(day('2026-01-15'), -2)),
      '2025-11-15'
    );
  });
});

describe('month bounds', () => {
  it('knows the length of every month, leap years included', () => {
    assert.equal(daysInMonth(2026, 1), 28);
    assert.equal(daysInMonth(2028, 1), 29);
    assert.equal(daysInMonth(2026, 3), 30);
    assert.equal(
      formatCalendarDay(endOfMonth(day('2028-02-10'))),
      '2028-02-29'
    );
  });

  it('lists the months of a range, inclusive', () => {
    assert.deepEqual(
      monthsBetween(day('2026-11-20'), day('2027-02-01')).map(
        formatCalendarMonth
      ),
      ['2026-11', '2026-12', '2027-01', '2027-02']
    );
  });
});

describe('utcToday', () => {
  it('takes the day of the instant in UTC, whatever the hour', () => {
    assert.equal(
      formatCalendarDay(utcToday(new Date('2026-10-26T23:59:59.999Z'))),
      '2026-10-26'
    );
    assert.equal(
      formatCalendarDay(utcToday(new Date('2026-10-26T21:00:00-03:00'))),
      '2026-10-27'
    );
  });
});
