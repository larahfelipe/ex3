import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOf } from '@/i18n/format';
import { nbsp } from '@/test/intl';

import { DEFAULT_CURRENCY, OFFERED_CURRENCIES } from './constants';
import { currencyFractionDigits } from './utils';

const {
  currencyNameOf,
  currencySymbolOf,
  formatCompactMoney,
  formatDecimal,
  formatList,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatUnitAmount
} = formatOf('pt-BR');

const english = formatOf('en-US');

describe('currencies', () => {
  it('offers the real first, as the default for a new record', () => {
    assert.equal(DEFAULT_CURRENCY, 'BRL');
    assert.deepEqual(OFFERED_CURRENCIES, ['BRL', 'USD', 'EUR']);
  });

  it('writes each amount in its own currency, with Brazilian separators', () => {
    assert.equal(formatMoney('1234.56', 'BRL'), nbsp('R$ 1.234,56'));
    assert.equal(formatMoney('1234.56', 'USD'), nbsp('US$ 1.234,56'));
    assert.equal(formatMoney('1234.56', 'EUR'), nbsp('€ 1.234,56'));
    assert.equal(formatMoney('-1234.56', 'BRL'), nbsp('-R$ 1.234,56'));
    assert.equal(formatMoney('0', 'BRL'), nbsp('R$ 0,00'));
  });

  it('never converts: only the symbol changes between currencies', () => {
    const figures = OFFERED_CURRENCIES.map((currency) =>
      formatMoney('98765.43', currency).replace(currencySymbolOf(currency), '')
    );

    assert.deepEqual(new Set(figures), new Set([nbsp(' 98.765,43')]));
  });

  it('follows each currency’s own minor units', () => {
    assert.equal(currencyFractionDigits('BRL'), 2);
    assert.equal(currencyFractionDigits('JPY'), 0);
    assert.equal(formatMoney('1234.56', 'JPY'), nbsp('JP¥ 1.235'));
  });

  it('writes the exact amount of a decimal string, past what a float holds', () => {
    assert.equal(
      formatMoney('12345678901234.56', 'BRL'),
      nbsp('R$ 12.345.678.901.234,56')
    );
  });

  it('names and marks the currencies in Portuguese', () => {
    assert.deepEqual(
      OFFERED_CURRENCIES.map((currency) => currencySymbolOf(currency)),
      ['R$', 'US$', '€']
    );
    assert.deepEqual(
      OFFERED_CURRENCIES.map((currency) => currencyNameOf(currency)),
      ['Real brasileiro', 'Dólar americano', 'Euro']
    );
  });

  it('shortens an axis tick in Portuguese', () => {
    assert.equal(formatCompactMoney(1234, 'BRL'), nbsp('R$ 1,2 mil'));
    assert.equal(formatCompactMoney('2500000', 'USD'), nbsp('US$ 2,5 mi'));
  });

  it('keeps a price’s and a unit’s digits', () => {
    assert.equal(formatPrice('0.123456', 'USD'), nbsp('US$ 0,123456'));
    assert.equal(formatPrice('10', 'BRL'), nbsp('R$ 10,00'));
    assert.equal(formatUnitAmount('0.00001234', 'BRL'), nbsp('R$ 0,00001234'));
  });
});

describe('numbers', () => {
  it('writes quantities with every digit they have', () => {
    assert.equal(formatQuantity('1234.5678'), '1.234,5678');
    assert.equal(formatQuantity('3'), '3');
  });

  it('writes a fixed number of decimals', () => {
    assert.equal(formatDecimal('1234.5', 2), '1.234,50');
  });

  it('writes a fraction as a percentage', () => {
    assert.equal(formatPercent('0.1234'), '12,34%');
    assert.equal(formatPercent('-0.05'), '-5%');
    assert.equal(formatPercent('0.1', { signDisplay: 'exceptZero' }), '+10%');
  });

  it('joins a list with “e”', () => {
    assert.equal(formatList(['a', 'b', 'c']), 'a, b e c');
    assert.equal(formatList(['a']), 'a');
  });
});

describe('in English', () => {
  it('writes amounts with American separators and symbols', () => {
    assert.equal(english.formatMoney('1234.56', 'USD'), '$1,234.56');
    assert.equal(english.formatMoney('1234.56', 'BRL'), 'R$1,234.56');
    assert.equal(english.formatMoney('-1234.56', 'EUR'), '-€1,234.56');
    assert.equal(english.formatCompactMoney(1234, 'USD'), '$1.2K');
    assert.equal(english.formatPrice('0.123456', 'USD'), '$0.123456');
  });

  it('names the currencies in English', () => {
    assert.deepEqual(
      OFFERED_CURRENCIES.map((currency) => english.currencyNameOf(currency)),
      ['Brazilian Real', 'US Dollar', 'Euro']
    );
    assert.equal(english.currencySymbolOf('USD'), '$');
  });

  it('writes numbers, percentages and lists', () => {
    assert.equal(english.formatQuantity('1234.5678'), '1,234.5678');
    assert.equal(english.formatDecimal('1234.5', 2), '1,234.50');
    assert.equal(english.formatPercent('0.1234'), '12.34%');
    assert.equal(english.formatList(['a', 'b', 'c']), 'a, b, and c');
  });

  it('binds the same formatters to a locale every time', () => {
    assert.equal(formatOf('en-US'), english);
    assert.notEqual(formatOf('pt-BR'), english);
  });
});
