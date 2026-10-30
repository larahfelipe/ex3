import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { numberTextOf } from './number-input';

describe('number input', () => {
  it('keeps only the digits of a count', () => {
    assert.equal(numberTextOf('12a3', false), '123');
    assert.equal(numberTextOf('-1e5', false), '15');
    assert.equal(numberTextOf('1.5', false), '15');
    assert.equal(numberTextOf('', false), '');
  });

  it('keeps either separator in a decimal, for the language to read', () => {
    assert.equal(numberTextOf('1.234,5', true), '1.234,5');
    assert.equal(numberTextOf('+0,25 un', true), '0,25');
    assert.equal(numberTextOf('1e-3', true), '13');
  });
});
