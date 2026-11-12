import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCalendarDay, parseCalendarDay } from './CalendarDay';
import {
  nextBillDay,
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

describe('nextBillDay', () => {
  const series = {
    frequency: 'MONTHLY' as const,
    startDate: day('2026-01-20'),
    endDate: null,
    generatedThrough: day('2026-12-31')
  };
  const today = day('2026-11-11');
  const nextOf = (
    rule: Parameters<typeof nextBillDay>[0],
    earliestCreated: string | null
  ) => {
    const next = nextBillDay(
      rule,
      today,
      earliestCreated === null ? null : day(earliestCreated)
    );

    return next === null ? null : formatCalendarDay(next);
  };

  it('is the day its earliest created bill is due, wherever an edit moved it', () => {
    assert.equal(nextOf(series, '2026-11-20'), '2026-11-20');
    assert.equal(nextOf(series, '2026-11-25'), '2026-11-25');
    assert.equal(nextOf(series, '2026-12-20'), '2026-12-20');
  });

  it('comes from the rule past the created bills, unless a bill was moved later still', () => {
    const generatedThroughNovember = {
      ...series,
      generatedThrough: day('2026-11-30')
    };

    assert.equal(nextOf(generatedThroughNovember, null), '2026-12-20');
    assert.equal(nextOf(generatedThroughNovember, '2027-01-05'), '2026-12-20');
    assert.equal(
      nextOf({ ...series, generatedThrough: day('2026-11-01') }, null),
      '2026-11-20'
    );
  });

  it('is none once neither a bill nor the rule is ahead', () => {
    const ending = {
      ...series,
      endDate: day('2026-12-31'),
      generatedThrough: day('2026-12-31')
    };

    assert.equal(nextOf(ending, null), null);
    assert.equal(nextOf(ending, '2027-01-10'), '2027-01-10');
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
