import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fullName } from './person-name';

describe('fullName', () => {
  it('joins the first and last names with one space', () => {
    assert.equal(fullName('Maria Clara', 'da Silva'), 'Maria Clara da Silva');
  });

  it('trims each name, so no edge or doubled space is left', () => {
    assert.equal(fullName(' Ana ', '  Lima '), 'Ana Lima');
  });

  it('is the first name alone when the last is blank', () => {
    assert.equal(fullName('Ana', ''), 'Ana');
    assert.equal(fullName('Ana', '   '), 'Ana');
  });
});
