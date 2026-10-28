import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCalendarDay, parseCalendarDay } from './CalendarDay';
import {
  nextOccurrence,
  occurrencesBetween,
  recurringExpenseStatusOf
} from './Recurrence';

const day = (value: string) => parseCalendarDay(value) as Date;

const daysOf = (dates: ReadonlyArray<Date>) => dates.map(formatCalendarDay);

describe('occurrencesBetween', () => {
  it('repeats a weekly series every seven days', () => {
    assert.deepEqual(
      daysOf(
        occurrencesBetween(
          { frequency: 'WEEKLY', startDate: day('2026-10-01'), endDate: null },
          day('2026-10-01'),
          day('2026-10-31')
        )
      ),
      ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
    );
  });

  it('keeps a monthly series on its day, on the last day of shorter months', () => {
    assert.deepEqual(
      daysOf(
        occurrencesBetween(
          { frequency: 'MONTHLY', startDate: day('2027-12-31'), endDate: null },
          day('2027-12-01'),
          day('2028-05-31')
        )
      ),
      [
        '2027-12-31',
        '2028-01-31',
        '2028-02-29',
        '2028-03-31',
        '2028-04-30',
        '2028-05-31'
      ]
    );
  });

  it('moves a yearly series started on 29 February to the 28th outside leap years', () => {
    assert.deepEqual(
      daysOf(
        occurrencesBetween(
          { frequency: 'YEARLY', startDate: day('2028-02-29'), endDate: null },
          day('2028-01-01'),
          day('2032-12-31')
        )
      ),
      ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']
    );
  });

  it('starts at the window, not at the start of the series', () => {
    assert.deepEqual(
      daysOf(
        occurrencesBetween(
          { frequency: 'MONTHLY', startDate: day('2026-01-10'), endDate: null },
          day('2026-10-11'),
          day('2027-01-10')
        )
      ),
      ['2026-11-10', '2026-12-10', '2027-01-10']
    );
  });

  it('stops at the end date, inclusive, and never before the start', () => {
    assert.deepEqual(
      daysOf(
        occurrencesBetween(
          {
            frequency: 'MONTHLY',
            startDate: day('2026-10-05'),
            endDate: day('2026-12-05')
          },
          day('2026-01-01'),
          day('2027-12-31')
        )
      ),
      ['2026-10-05', '2026-11-05', '2026-12-05']
    );
  });

  it('is empty for a window that ends before the start', () => {
    assert.deepEqual(
      occurrencesBetween(
        { frequency: 'WEEKLY', startDate: day('2026-10-05'), endDate: null },
        day('2026-09-01'),
        day('2026-10-04')
      ),
      []
    );
  });
});

describe('nextOccurrence', () => {
  const rule = {
    frequency: 'MONTHLY' as const,
    startDate: day('2026-01-31'),
    endDate: day('2026-06-30')
  };

  it('finds the first occurrence on or after a day', () => {
    assert.equal(
      formatCalendarDay(nextOccurrence(rule, day('2026-02-28')) as Date),
      '2026-02-28'
    );
    assert.equal(
      formatCalendarDay(nextOccurrence(rule, day('2026-03-01')) as Date),
      '2026-03-31'
    );
  });

  it('is null once the series has ended', () => {
    assert.equal(nextOccurrence(rule, day('2026-07-01')), null);
  });
});

describe('recurringExpenseStatusOf', () => {
  const today = day('2026-10-26');

  it('keeps a series active through its end date', () => {
    assert.equal(
      recurringExpenseStatusOf(
        { endDate: day('2026-10-26'), cancelledAt: null },
        today
      ),
      'ACTIVE'
    );
    assert.equal(
      recurringExpenseStatusOf({ endDate: null, cancelledAt: null }, today),
      'ACTIVE'
    );
  });

  it('ends a series the day after its end date', () => {
    assert.equal(
      recurringExpenseStatusOf(
        { endDate: day('2026-10-25'), cancelledAt: null },
        today
      ),
      'ENDED'
    );
  });

  it('reports a cancelled series as cancelled whatever its end date', () => {
    assert.equal(
      recurringExpenseStatusOf(
        { endDate: day('2026-10-25'), cancelledAt: new Date() },
        today
      ),
      'CANCELLED'
    );
  });
});
