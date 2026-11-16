import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cardStatementOf } from './card-statement';
import { shiftCalendarDay } from './dates';

const statementOf = (
  cycle: Record<'closingDay' | 'dueDay', number>,
  chargeDay: string
) => {
  const statement = cardStatementOf(cycle, chargeDay);

  return statement && [statement.closingDate, statement.dueDate];
};

describe('cardStatementOf', () => {
  it('puts a charge made before the closing day on the statement due that month', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-02'), [
      '2026-11-03',
      '2026-11-10'
    ]);
  });

  it('moves a charge made on or after the closing day to the next statement', () => {
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-03'), [
      '2026-12-03',
      '2026-12-10'
    ]);
    assert.deepEqual(statementOf({ closingDay: 3, dueDay: 10 }, '2026-11-05'), [
      '2026-12-03',
      '2026-12-10'
    ]);
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

  it('falls on the last day of a shorter month, leap years included', () => {
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
    assert.deepEqual(
      statementOf({ closingDay: 30, dueDay: 31 }, '2027-02-27'),
      ['2027-02-28', '2027-02-28']
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
        let charge: string | null = '2027-01-01';
        charge !== null && charge <= '2028-12-31';
        charge = shiftCalendarDay(charge, 1)
      ) {
        const statement = cardStatementOf(cycle, charge);

        assert.ok(statement !== null);
        assert.ok(statement.closingDate > charge);
        assert.ok(statement.dueDate > charge);
        assert.ok(statement.dueDate >= statement.closingDate);
      }
  });

  it('has no statement for a day that is not a calendar day', () => {
    assert.equal(cardStatementOf({ closingDay: 3, dueDay: 10 }, ''), null);
    assert.equal(
      cardStatementOf({ closingDay: 3, dueDay: 10 }, '2026-02-30'),
      null
    );
  });
});
