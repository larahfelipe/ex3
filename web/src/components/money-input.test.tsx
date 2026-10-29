import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { CurrencyAmountInput } from './money-input';

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
    assert.equal(textOf(markup), 'R$BRL');
  });

  it('keeps the record’s own currency and its minor units', () => {
    assert.equal(textOf(amountInput('10', 'USD')), 'US$USD');
    assert.match(amountInput('1500', 'JPY', 0), /value="1\.500"/);
  });
});
