import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCalendarDay, parseCalendarDay } from './CalendarDay';
import { cardDueDateOf, cardStatementOf } from './CardStatement';

const day = (value: string) => parseCalendarDay(value) as Date;

const statementOf = (
  cycle: Record<'closingDay' | 'dueDay', number>,
  chargeDay: string
) => {
  const { closingDate, dueDate } = cardStatementOf(cycle, day(chargeDay));

  return [formatCalendarDay(closingDate), formatCalendarDay(dueDate)];
};

describe('cardStatementOf', () => {
  it('puts a charge made before the closing day on the statement due that month', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-02'), [
      '2026-11-03',
      '2026-11-10'
    ]);
  });

  it('moves a charge made on the closing day to the next statement', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-03'), [
      '2026-12-03',
      '2026-12-10'
    ]);
  });

  it('moves a charge made after the closing day, before the due day, to the next statement', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-05'), [
      '2026-12-03',
      '2026-12-10'
    ]);
  });

  it('moves a charge made after this month’s due day to the next statement', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-20'), [
      '2026-12-03',
      '2026-12-10'
    ]);
  });

  it('closes the month before when the closing day comes after the due day', () => {
    assert.deepEqual(statementOf({ closingDay: 25, dueDay: 5 }, '2026-11-20'), [
      '2026-11-25',
      '2026-12-05'
    ]);
    assert.deepEqual(statementOf({ closingDay: 25, dueDay: 5 }, '2026-11-25'), [
      '2026-12-25',
      '2027-01-05'
    ]);
  });

  it('crosses into the next year', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-12-15'), [
      '2027-01-03',
      '2027-01-10'
    ]);
    assert.deepEqual(statementOf({ closingDay: 25, dueDay: 5 }, '2026-12-31'), [
      '2027-01-25',
      '2027-02-05'
    ]);
  });

  it('falls on the last day of a shorter month', () => {
    assert.deepEqual(
      statementOf({ closingDay: 24, dueDay: 31 }, '2027-02-10'),
      ['2027-02-24', '2027-02-28']
    );
    assert.deepEqual(
      statementOf({ closingDay: 24, dueDay: 31 }, '2028-02-10'),
      ['2028-02-24', '2028-02-29']
    );
    assert.deepEqual(
      statementOf({ closingDay: 24, dueDay: 31 }, '2026-04-01'),
      ['2026-04-24', '2026-04-30']
    );
  });

  it('closes on the last day of a shorter month and returns to its day after', () => {
    assert.deepEqual(statementOf({ closingDay: 31, dueDay: 7 }, '2027-02-27'), [
      '2027-02-28',
      '2027-03-07'
    ]);
    assert.deepEqual(statementOf({ closingDay: 31, dueDay: 7 }, '2027-02-28'), [
      '2027-03-31',
      '2027-04-07'
    ]);
  });

  it('keeps a charge before a shortened closing day on that statement, even when both days fall on the month’s last day', () => {
    assert.deepEqual(
      statementOf({ closingDay: 30, dueDay: 31 }, '2027-02-27'),
      ['2027-02-28', '2027-02-28']
    );
    assert.deepEqual(
      statementOf({ closingDay: 30, dueDay: 31 }, '2027-02-28'),
      ['2027-03-30', '2027-03-31']
    );
  });

  it('is always due after the charge', () => {
    for (const cycle of [
      { closingDay: 1, dueDay: 31 },
      { closingDay: 31, dueDay: 1 },
      { closingDay: 28, dueDay: 29 },
      { closingDay: 15, dueDay: 14 }
    ])
      for (
        let charge = day('2027-01-01');
        charge.getTime() <= day('2028-12-31').getTime();
        charge = new Date(charge.getTime() + 24 * 60 * 60 * 1000)
      ) {
        const { closingDate, dueDate } = cardStatementOf(cycle, charge);

        assert.ok(closingDate.getTime() > charge.getTime());
        assert.ok(dueDate.getTime() > charge.getTime());
        assert.ok(dueDate.getTime() >= closingDate.getTime());
      }
  });
});

describe('cardDueDateOf', () => {
  it('is the due date of the statement the bill’s own due date lands on', () => {
    assert.equal(
      formatCalendarDay(
        cardDueDateOf({ closingDay: 3, dueDay: 10 }, day('2026-11-05'))
      ),
      '2026-12-10'
    );
  });
});
