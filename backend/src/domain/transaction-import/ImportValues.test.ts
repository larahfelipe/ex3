import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SlashedDates } from './ImportRecord';
import {
  isWithin,
  normalizeLabel,
  parseDecimal,
  parseTradeDate,
  saoPauloDayOf,
  settlementDaysOf,
  slashedDateOrderOf,
  startOfTradingDay,
  textOf,
  tradeDaysOf,
  writtenDecimalSeparatorOf,
  type ImportCell
} from './ImportValues';

const text = (value: string): ImportCell => ({ kind: 'text', value });
const number = (value: string): ImportCell => ({ kind: 'number', value });

const decimalOf = (cell: ImportCell | null, convention: ',' | '.' = ',') => {
  const result = parseDecimal(cell, convention);

  return result.outcome === 'parsed' ? result.value : result.outcome;
};

const dayOf = (
  cell: ImportCell | null,
  date1904 = false,
  slashedDates: SlashedDates = 'day-first'
) => {
  const result = parseTradeDate(cell, { date1904, slashedDates });

  return result.outcome === 'parsed' ? result.value : result.outcome;
};

describe('normalizeLabel', () => {
  it('compares labels without accents, case or repeated blanks', () => {
    assert.equal(
      normalizeLabel('  Código de   Negociação '),
      'codigo de negociacao'
    );
    assert.equal(normalizeLabel('Entrada/Saída'), 'entrada/saida');
  });
});

describe('textOf', () => {
  it('reads a blank, a dash or a hyphen as no value', () => {
    for (const value of ['', '  ', '-', '–', '—'])
      assert.equal(textOf(text(value)), null);

    assert.equal(textOf(null), null);
    assert.equal(textOf(text(' PETR4 ')), 'PETR4');
  });
});

describe('parseDecimal', () => {
  it('stores a number cell as is, refusing a negative one', () => {
    assert.equal(decimalOf(number('1234.5')), '1234.5');
    assert.equal(
      decimalOf(number('0.000000000000000001')),
      '0.000000000000000001'
    );
    assert.equal(decimalOf(number('-1')), 'invalid');
  });

  it('reads the Brazilian convention, thousands groups and a currency sign', () => {
    assert.equal(decimalOf(text('1.234,56')), '1234.56');
    assert.equal(decimalOf(text('R$ 1.234,56')), '1234.56');
    assert.equal(decimalOf(text('10,5')), '10.5');
    assert.equal(decimalOf(text('1.234.567')), '1234567');
    assert.equal(decimalOf(text('100')), '100');
  });

  it('reads the convention of the other separator when the value fixes it', () => {
    assert.equal(decimalOf(text('1,234.56')), '1234.56');
    assert.equal(decimalOf(text('US$ 1,234,567.8')), '1234567.8');
    assert.equal(decimalOf(text('0.5')), '0.5');
    assert.equal(decimalOf(text('1234.567')), '1234.567');
    assert.equal(decimalOf(text('R$ 0.018'), ','), '0.018');
    assert.equal(decimalOf(text('0,018'), '.'), '0.018');
  });

  it('leaves a value ambiguous on its own to the convention of the file', () => {
    assert.equal(decimalOf(text('1.234'), ','), '1234');
    assert.equal(decimalOf(text('1.234'), '.'), '1.234');
    assert.equal(decimalOf(text('1,234'), ','), '1.234');
    assert.equal(decimalOf(text('1,234'), '.'), '1234');
  });

  it('tells the separator a text number shows its decimals with', () => {
    assert.equal(writtenDecimalSeparatorOf(text('R$ 48.00')), '.');
    assert.equal(writtenDecimalSeparatorOf(text('1,234.5')), '.');
    assert.equal(writtenDecimalSeparatorOf(text('0.018')), '.');
    assert.equal(writtenDecimalSeparatorOf(text('48,00')), ',');
    assert.equal(writtenDecimalSeparatorOf(text('1.234.567')), ',');

    for (const value of ['1.234', '1,234', '10', '-', '05/01/2026', '1.2.3'])
      assert.equal(writtenDecimalSeparatorOf(text(value)), null, value);

    assert.equal(writtenDecimalSeparatorOf(number('48.5')), null);
    assert.equal(writtenDecimalSeparatorOf(null), null);
  });

  it('reads a blank or a dash as missing', () => {
    assert.equal(decimalOf(null), 'missing');
    assert.equal(decimalOf(text(' ')), 'missing');
    assert.equal(decimalOf(text('-')), 'missing');
  });

  it('refuses what is not a non-negative decimal the columns store', () => {
    for (const value of [
      '-5',
      'abc',
      '1,2,3,4',
      '1.2.3',
      '12.34.567',
      '1,23.4',
      '.',
      'R$',
      '1e5',
      '123456789012345678901',
      '0,1234567890123456789'
    ])
      assert.equal(decimalOf(text(value)), 'invalid', value);
  });
});

describe('parseTradeDate', () => {
  it('reads a Brazilian day and an ISO day, ignoring a time after it', () => {
    assert.equal(dayOf(text('05/01/2026')), '2026-01-05');
    assert.equal(dayOf(text('5/1/2026')), '2026-01-05');
    assert.equal(dayOf(text('2026-01-05')), '2026-01-05');
    assert.equal(dayOf(text('2026-01-05T10:30:00')), '2026-01-05');
  });

  it('reads the serial a workbook stores a date as, in either epoch', () => {
    assert.equal(dayOf(number('46027')), '2026-01-05');
    assert.equal(dayOf(number('46027.75')), '2026-01-05');
    assert.equal(dayOf(number('44565'), true), '2026-01-05');
  });

  it('calls a slashed day ambiguous where the month may come first, and reads the rest', () => {
    for (const value of ['05/01/2026', '25/01/2026', '01/25/2026'])
      assert.equal(dayOf(text(value), false, 'ambiguous'), 'ambiguous', value);

    assert.equal(dayOf(text('2026-01-05'), false, 'ambiguous'), '2026-01-05');
    assert.equal(dayOf(number('46027'), false, 'ambiguous'), '2026-01-05');
    assert.equal(dayOf(text('2026-02-30'), false, 'ambiguous'), 'invalid');
  });

  it('reads a slashed day month first where the file shows it', () => {
    assert.equal(dayOf(text('01/25/2026'), false, 'month-first'), '2026-01-25');
    assert.equal(dayOf(text('3/5/2026'), false, 'month-first'), '2026-03-05');
    assert.equal(dayOf(text('25/01/2026'), false, 'month-first'), 'invalid');
  });

  it('tells the order of a slashed day only when one part cannot be a month', () => {
    assert.equal(slashedDateOrderOf(text('25/01/2026')), 'day-first');
    assert.equal(slashedDateOrderOf(text('01/25/2026')), 'month-first');

    for (const value of ['05/01/2026', '13/13/2026', '2026-01-25'])
      assert.equal(slashedDateOrderOf(text(value)), null, value);

    assert.equal(slashedDateOrderOf(number('46027')), null);
  });

  it('refuses a day that is not one of the calendar', () => {
    for (const value of [
      '31/02/2026',
      '01/13/2026',
      '2026-02-30',
      '05-01-2026'
    ])
      assert.equal(dayOf(text(value)), 'invalid', value);

    assert.equal(dayOf(number('0')), 'invalid');
    assert.equal(dayOf(number('100000000')), 'invalid');
    assert.equal(dayOf(number('2958465')), '9999-12-31');
    assert.equal(dayOf(number('2957004'), true), 'invalid');
    assert.equal(dayOf(text('')), 'missing');
  });
});

describe('settlement days', () => {
  it('reaches from the trade to a week after it', () => {
    const settledOn = (tradeDay: string, day: string) =>
      isWithin(day, settlementDaysOf(tradeDay));

    assert.equal(settledOn('2026-01-05', '2026-01-05'), true);
    assert.equal(settledOn('2026-01-05', '2026-01-07'), true);
    assert.equal(settledOn('2026-12-28', '2027-01-04'), true);
    assert.equal(settledOn('2026-01-05', '2026-01-13'), false);
    assert.equal(settledOn('2026-01-05', '2026-01-04'), false);
  });

  it('reaches back from the settlement to a week before it', () => {
    const madeOn = (settlementDay: string, day: string) =>
      isWithin(day, tradeDaysOf(settlementDay));

    assert.equal(madeOn('2026-01-05', '2026-01-05'), true);
    assert.equal(madeOn('2026-01-07', '2026-01-05'), true);
    assert.equal(madeOn('2027-01-04', '2026-12-28'), true);
    assert.equal(madeOn('2026-01-13', '2026-01-05'), false);
    assert.equal(madeOn('2026-01-04', '2026-01-05'), false);
  });
});

describe('trading days', () => {
  it('starts a day at midnight in São Paulo', () => {
    assert.equal(
      startOfTradingDay('2026-01-05').toISOString(),
      '2026-01-05T03:00:00.000Z'
    );
    assert.equal(
      saoPauloDayOf(new Date('2026-01-05T02:59:59.999Z')),
      '2026-01-04'
    );
    assert.equal(
      saoPauloDayOf(new Date('2026-01-05T03:00:00.000Z')),
      '2026-01-05'
    );
  });

  it('starts a day daylight saving time began on at the first hour it has', () => {
    const start = startOfTradingDay('2018-11-04');

    assert.equal(start.toISOString(), '2018-11-04T03:00:00.000Z');
    assert.equal(saoPauloDayOf(start), '2018-11-04');
    assert.equal(
      startOfTradingDay('2019-01-15').toISOString(),
      '2019-01-15T02:00:00.000Z'
    );
  });
});
