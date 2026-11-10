import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fullName, personNames } from './PersonName';

describe('fullName', () => {
  it('joins the first and last names with one space', () => {
    assert.equal(fullName('Ana', 'Lima'), 'Ana Lima');
  });

  it('keeps the spaces inside each name', () => {
    assert.equal(fullName('Maria Clara', 'da Silva'), 'Maria Clara da Silva');
  });

  it('trims each name, so no edge or doubled space is left', () => {
    assert.equal(fullName(' Ana ', '  Lima '), 'Ana Lima');
  });

  it('is the one name held when the other is missing or blank', () => {
    assert.equal(fullName('Ana', null), 'Ana');
    assert.equal(fullName('Ana', ' '), 'Ana');
    assert.equal(fullName(null, 'Lima'), 'Lima');
  });

  it('is empty when neither name is held', () => {
    assert.equal(fullName(null, null), '');
  });
});

describe('personNames', () => {
  it('pairs the names with the full name read from them', () => {
    assert.deepEqual(personNames('Ana', 'Lima'), {
      firstName: 'Ana',
      lastName: 'Lima',
      name: 'Ana Lima'
    });
    assert.deepEqual(personNames('Ana', null), {
      firstName: 'Ana',
      lastName: null,
      name: 'Ana'
    });
  });

  it('has no full name when neither name is held', () => {
    assert.deepEqual(personNames(null, null), {
      firstName: null,
      lastName: null,
      name: null
    });
  });
});
