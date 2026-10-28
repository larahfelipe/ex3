import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fitsMinorUnits,
  minorUnitsOf,
  monthlyEquivalentOf,
  ratioOf,
  splitIntoInstallments,
  sumOf
} from './FinanceMoney';

describe('minorUnitsOf', () => {
  it('reads the minor unit of each currency from ISO 4217', () => {
    assert.equal(minorUnitsOf('BRL'), 2);
    assert.equal(minorUnitsOf('JPY'), 0);
    assert.equal(minorUnitsOf('KWD'), 3);
  });
});

describe('fitsMinorUnits', () => {
  it('accepts an amount with at most the currency minor unit', () => {
    assert.equal(fitsMinorUnits('10.25', 'BRL'), true);
    assert.equal(fitsMinorUnits('10.250', 'BRL'), true);
    assert.equal(fitsMinorUnits('10.255', 'BRL'), false);
    assert.equal(fitsMinorUnits('1000', 'JPY'), true);
    assert.equal(fitsMinorUnits('1000.5', 'JPY'), false);
  });
});

describe('sumOf', () => {
  it('adds decimals exactly, where binary floating point drifts', () => {
    assert.equal(sumOf(['0.1', '0.2']).toFixed(), '0.3');
    assert.equal(
      sumOf(['99999999999999999999.99', '0.01']).toFixed(),
      '100000000000000000000'
    );
  });
});

describe('splitIntoInstallments', () => {
  it('gives the remainder of the truncation to the first installment', () => {
    const amounts = splitIntoInstallments('100', 3, 'BRL');

    assert.deepEqual(amounts, ['33.34', '33.33', '33.33']);
    assert.equal(sumOf(amounts ?? []).toFixed(), '100');
  });

  it('splits evenly when the total divides', () => {
    assert.deepEqual(splitIntoInstallments('1200', 12, 'BRL'), [
      ...Array.from({ length: 12 }, () => '100')
    ]);
  });

  it('works in whole units for a currency without minor units', () => {
    assert.deepEqual(splitIntoInstallments('1000', 3, 'JPY'), [
      '334',
      '333',
      '333'
    ]);
  });

  it('always adds up to the total', () => {
    for (const [total, count] of [
      ['999.99', 7],
      ['0.1', 10],
      ['12345.67', 360],
      ['1', 1]
    ] as const) {
      const amounts = splitIntoInstallments(total, count, 'BRL');

      assert.ok(amounts);
      assert.equal(amounts.length, count);
      assert.equal(sumOf(amounts).toFixed(), total);
    }
  });

  it('refuses a total too small to give each installment a minor unit', () => {
    assert.equal(splitIntoInstallments('0.05', 10, 'BRL'), null);
  });
});

describe('monthlyEquivalentOf', () => {
  it('spreads weekly and yearly amounts over a month, truncated', () => {
    assert.equal(monthlyEquivalentOf('100', 'WEEKLY', 'BRL'), '433.33');
    assert.equal(monthlyEquivalentOf('1000', 'YEARLY', 'BRL'), '83.33');
    assert.equal(monthlyEquivalentOf('59.9', 'MONTHLY', 'BRL'), '59.9');
  });
});

describe('ratioOf', () => {
  it('is a fraction truncated at 18 places, absent for a zero divisor', () => {
    assert.equal(ratioOf('1', '3'), '0.333333333333333333');
    assert.equal(ratioOf('-1', '3'), '-0.333333333333333333');
    assert.equal(ratioOf('5', '0'), null);
  });
});
