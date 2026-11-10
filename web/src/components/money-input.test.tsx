import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { CurrencyAmountInput, CurrencySelect } from './money-input';

const amountInput = (value: string, currency: string, decimals = 2) =>
  renderWithIntl(
    <CurrencyAmountInput
      value={value}
      currency={currency}
      decimals={decimals}
      onValueChange={() => undefined}
      onRejectedPaste={() => undefined}
    />
  );

describe('amount input', () => {
  it('shows the amount grouped in Portuguese, the decimal the API takes held apart', () => {
    const markup = amountInput('1234.5', 'BRL');

    assert.match(markup, /value="1\.234,50"/);
    assert.match(markup, /placeholder="0,00"/);
    assert.equal(textOf(markup), 'R$');
  });

  it('keeps the record’s own currency and its minor units', () => {
    assert.equal(textOf(amountInput('10', 'USD')), 'US$');
    assert.match(amountInput('1500', 'JPY', 0), /value="1\.500"/);
  });

  it('leads with the currency select, showing the symbol and naming the currency', () => {
    const markup = renderWithIntl(
      <CurrencyAmountInput
        value="10"
        currency="USD"
        decimals={2}
        currencyControl={
          <CurrencySelect value="USD" onValueChange={() => undefined} />
        }
        onValueChange={() => undefined}
        onRejectedPaste={() => undefined}
      />
    );

    assert.ok(markup.indexOf('role="combobox"') < markup.indexOf('<input'));
    assert.match(textOf(markup), /^US\$\s*\S/);
    assert.match(markup, /class="sr-only">[^<]+</);
  });
});
