import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calendarDayOfDate } from '@/lib/dates';

import { calendarBoundsOf } from './date-picker';

const TODAY = '2026-11-15';

const daysOf = ({
  startMonth,
  endMonth,
  disabled
}: ReturnType<typeof calendarBoundsOf>) => ({
  startMonth: startMonth && calendarDayOfDate(startMonth),
  endMonth: endMonth && calendarDayOfDate(endMonth),
  disabled: disabled.map(({ before, after }) => ({
    ...(before !== undefined && { before: calendarDayOfDate(before) }),
    ...(after !== undefined && { after: calendarDayOfDate(after) })
  }))
});

describe('a date picker’s range', () => {
  it('reaches years past this one when nothing bounds it, and disables no day', () => {
    const bounds = calendarBoundsOf(TODAY, {});

    assert.deepEqual(daysOf(bounds), {
      startMonth: '1926-11-15',
      endMonth: '2126-11-15',
      disabled: []
    });
    assert.equal(bounds.isTodayAllowed, true);
  });

  it('starts at its earliest day, which stays selectable, and stays open ahead', () => {
    const bounds = calendarBoundsOf(TODAY, { min: TODAY });

    assert.deepEqual(daysOf(bounds), {
      startMonth: TODAY,
      endMonth: '2126-11-15',
      disabled: [{ before: TODAY }]
    });
    assert.equal(bounds.isTodayAllowed, true);
  });

  it('ends at its latest day and offers today only while it is within', () => {
    assert.deepEqual(daysOf(calendarBoundsOf(TODAY, { max: TODAY })), {
      startMonth: '1926-11-15',
      endMonth: TODAY,
      disabled: [{ after: TODAY }]
    });
    assert.equal(calendarBoundsOf(TODAY, { max: TODAY }).isTodayAllowed, true);
    assert.equal(
      calendarBoundsOf(TODAY, { max: '2026-11-14' }).isTodayAllowed,
      false
    );
    assert.equal(
      calendarBoundsOf(TODAY, { min: '2026-11-16' }).isTodayAllowed,
      false
    );
  });
});
