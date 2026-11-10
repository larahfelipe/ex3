import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOf } from '@/i18n/format';
import { translatorOf } from '@/i18n/translator';

import { pastedAmountIssueOf, typedAmountIssueOf } from './amount-issues';
import {
  compareDecimals,
  decimalOfUnits,
  isStorableDecimal,
  roundDecimal,
  shiftByWholeUnits,
  unitsOf
} from './decimal';

const portuguese = formatOf('pt-BR');
const english = formatOf('en-US');
const { decimalInputTextOf, readDecimal } = portuguese;

const read = (value: string) => ({ outcome: 'read', value });

describe('reading a typed number', () => {
  it('reads the Brazilian convention', () => {
    assert.deepEqual(readDecimal('1,5'), read('1.5'));
    assert.deepEqual(readDecimal('0,500'), read('0.500'));
    assert.deepEqual(readDecimal('1.234,56'), read('1234.56'));
    assert.deepEqual(readDecimal('1.234.567'), read('1234567'));
    assert.deepEqual(readDecimal('1 234,5'), read('1234.5'));
  });

  it('reads the other convention where it cannot be a Brazilian number', () => {
    assert.deepEqual(readDecimal('1.5'), read('1.5'));
    assert.deepEqual(readDecimal('1234.5678'), read('1234.5678'));
    assert.deepEqual(readDecimal('1,234.56'), read('1234.56'));
    assert.deepEqual(readDecimal('1,234,567'), read('1234567'));
  });

  it('refuses a lone dot before three digits, which either convention reads its own way', () => {
    assert.deepEqual(readDecimal('1.500'), {
      outcome: 'ambiguous',
      asDecimal: '1.500',
      asWhole: '1500'
    });
    assert.deepEqual(readDecimal('1,500'), read('1.500'));
  });

  it('refuses what is not a storable number', () => {
    for (const text of ['', 'abc', '1,2,3', '1.2.3', ',5', '5,', '-1', '1e3'])
      assert.deepEqual(readDecimal(text), { outcome: 'unreadable' }, text);

    assert.deepEqual(readDecimal('1'.repeat(21)), { outcome: 'unreadable' });
  });

  it('writes a value back as the field reads it, unchanged', () => {
    for (const value of ['1', '1.5', '1.250', '100.000', '0.001', '1500.25']) {
      const text = decimalInputTextOf(value);

      assert.doesNotMatch(text, /\./, value);
      assert.deepEqual(readDecimal(text), read(value), value);
    }
  });
});

describe('reading a number typed in English', () => {
  it('reads the American convention', () => {
    assert.deepEqual(english.readDecimal('1.5'), read('1.5'));
    assert.deepEqual(english.readDecimal('1,234.56'), read('1234.56'));
    assert.deepEqual(english.readDecimal('1,234,567'), read('1234567'));
  });

  it('reads the Brazilian convention where it cannot be an American number', () => {
    assert.deepEqual(english.readDecimal('1,5'), read('1.5'));
    assert.deepEqual(english.readDecimal('1.234,56'), read('1234.56'));
    assert.deepEqual(english.readDecimal('1.500'), read('1.500'));
  });

  it('refuses a lone comma before three digits instead', () => {
    assert.deepEqual(english.readDecimal('1,500'), {
      outcome: 'ambiguous',
      asDecimal: '1.500',
      asWhole: '1500'
    });
  });

  it('writes a value back with a decimal point', () => {
    for (const value of ['1', '1.5', '1.250', '0.001', '1500.25']) {
      const text = english.decimalInputTextOf(value);

      assert.equal(text, value);
      assert.deepEqual(english.readDecimal(text), read(value), value);
    }
  });
});

describe('ambiguous amounts', () => {
  const t = translatorOf('pt-BR', 'validation');
  const ambiguous = readDecimal('1.500');

  assert.equal(ambiguous.outcome, 'ambiguous');

  it('tells what to type for each reading', () => {
    assert.equal(
      typedAmountIssueOf(ambiguous, t, portuguese),
      'Valor ambíguo: escreva 1,500 se houver casas decimais ou 1500 se for um número inteiro'
    );
  });

  it('names the amounts a pasted value could be', () => {
    assert.equal(
      pastedAmountIssueOf(ambiguous, t, portuguese),
      'O valor colado pode ser 1,5 ou 1.500: digite os algarismos'
    );
  });

  it('names them in English, in its convention', () => {
    const englishAmbiguous = english.readDecimal('1,500');

    assert.equal(englishAmbiguous.outcome, 'ambiguous');
    assert.equal(
      typedAmountIssueOf(
        englishAmbiguous,
        translatorOf('en-US', 'validation'),
        english
      ),
      'Ambiguous amount: write 1.500 if it has decimal places or 1500 if it is a whole number'
    );
  });

  it('states the column’s limits for anything else', () => {
    assert.equal(
      typedAmountIssueOf({ outcome: 'unreadable' }, t, portuguese),
      'Use um número com até 20 dígitos inteiros e 18 casas decimais'
    );
  });
});

describe('arithmetic', () => {
  it('counts units exactly, past what a float holds', () => {
    assert.equal(unitsOf('12345678901234567.89', 2), 1234567890123456789n);
    assert.equal(
      decimalOfUnits(1234567890123456789n, 2),
      '12345678901234567.89'
    );
    assert.equal(decimalOfUnits(5n, 3), '0.005');
    assert.equal(decimalOfUnits(5n, 0), '5');
  });

  it('rounds halves away from zero', () => {
    assert.equal(roundDecimal('1.005', 2), '1.01');
    assert.equal(roundDecimal('1.004', 2), '1.00');
    assert.equal(roundDecimal('2.5', 0), '3');
    assert.equal(roundDecimal('1.5', 3), '1.500');
  });

  it('orders decimals exactly, whatever their scales', () => {
    assert.equal(compareDecimals('10', '9.99'), 1);
    assert.equal(compareDecimals('1.50', '1.5'), 0);
    assert.equal(compareDecimals('0.000000000000000001', '0'), 1);
    assert.equal(
      compareDecimals(`${'9'.repeat(20)}.1`, `${'9'.repeat(20)}.2`),
      -1
    );
  });

  it('steps by whole units, keeping the decimals', () => {
    assert.equal(shiftByWholeUnits('1.25', 1), '2.25');
    assert.equal(shiftByWholeUnits('1.25', -1), '0.25');
    assert.equal(shiftByWholeUnits('1', -1), null);
    assert.equal(shiftByWholeUnits('9'.repeat(20), 1), null);
  });

  it('stores what the API’s DECIMAL(38,18) column holds unrounded', () => {
    assert.equal(isStorableDecimal('0'), true);
    assert.equal(
      isStorableDecimal(`${'9'.repeat(20)}.${'9'.repeat(18)}`),
      true
    );
    assert.equal(isStorableDecimal('1.'.concat('1'.repeat(19))), false);
    assert.equal(isStorableDecimal('01'), false);
    assert.equal(isStorableDecimal('-1'), false);
  });
});
