import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transactionEffectOf } from './transaction-effect';

const amounts = (
  quantity: string,
  unitPrice: string,
  fees = '',
  taxes = ''
) => ({ quantity, unitPrice, fees, taxes });

describe('a transaction’s effect', () => {
  it('adds the charges to what a buy costs', () => {
    assert.deepEqual(
      transactionEffectOf('BUY', amounts('10', '12.34', '4.9', '0.1')),
      {
        quantity: '10',
        unitPrice: '12.34',
        gross: '123.40',
        charges: '5.00',
        net: '128.40'
      }
    );
  });

  it('adds them to a bonus too, whose units may come at no cost', () => {
    assert.deepEqual(transactionEffectOf('BONUS', amounts('5', '0', '1.5')), {
      quantity: '5',
      unitPrice: '0',
      gross: '0.0',
      charges: '1.5',
      net: '1.5'
    });
  });

  it('takes the charges from what a sale brings in', () => {
    assert.deepEqual(
      transactionEffectOf('SELL', amounts('3', '20', '2', '1')),
      { quantity: '3', unitPrice: '20', gross: '60', charges: '3', net: '57' }
    );
  });

  it('takes the tax withheld from an income', () => {
    assert.deepEqual(
      transactionEffectOf('JCP', amounts('100', '0.25', '', '3.75')),
      {
        quantity: '100',
        unitPrice: '0.25',
        gross: '25.00',
        charges: '3.75',
        net: '21.25'
      }
    );
  });

  it('keeps a sale whose charges exceed it negative', () => {
    assert.deepEqual(transactionEffectOf('SELL', amounts('1', '1', '5')), {
      quantity: '1',
      unitPrice: '1',
      gross: '1',
      charges: '5',
      net: '-4'
    });
  });

  it('multiplies exactly, past what a float holds', () => {
    assert.deepEqual(
      transactionEffectOf('BUY', amounts('0.123456789012345678', '98765.4321')),
      {
        quantity: '0.123456789012345678',
        unitPrice: '98765.4321',
        gross: '12193.2631124828531222374638',
        charges: '0.0000000000000000000000',
        net: '12193.2631124828531222374638'
      }
    );
  });

  it('shows nothing while an amount is not a number the column stores', () => {
    assert.equal(transactionEffectOf('BUY', amounts('', '10')), null);
    assert.equal(transactionEffectOf('BUY', amounts('1', '')), null);
    assert.equal(transactionEffectOf('BUY', amounts('1', '10', '-1')), null);
  });
});
