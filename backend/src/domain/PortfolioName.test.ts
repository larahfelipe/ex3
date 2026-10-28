import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePortfolioName, portfolioNameKey } from './PortfolioName';

const COMPOSED_NAME = 'A\u00e7\u00f5es';
const DECOMPOSED_NAME = 'Ac\u0327o\u0303es';

describe('normalizePortfolioName', () => {
  it('trims the name and folds each run of whitespace into one space', () => {
    assert.equal(
      normalizePortfolioName(' \tLong \n  term\u00a0 '),
      'Long term'
    );
  });

  it('keeps the letter case and the accents, in their composed form', () => {
    assert.equal(normalizePortfolioName(DECOMPOSED_NAME), COMPOSED_NAME);
    assert.equal(normalizePortfolioName('Renda FIXA'), 'Renda FIXA');
  });

  it('leaves a normalized name as it is', () => {
    assert.equal(normalizePortfolioName('Main'), 'Main');
  });

  it('reduces a name of whitespace alone to nothing', () => {
    assert.equal(normalizePortfolioName(' \t\n '), '');
  });
});

describe('portfolioNameKey', () => {
  it('gives names that differ in letter case or whitespace one key', () => {
    assert.equal(
      portfolioNameKey('  Long  TERM '),
      portfolioNameKey('long term')
    );
    assert.equal(
      portfolioNameKey(DECOMPOSED_NAME),
      portfolioNameKey('A\u00c7\u00d5ES')
    );
  });

  it('keeps names apart that differ in a letter or an accent', () => {
    assert.notEqual(portfolioNameKey('Acoes'), portfolioNameKey(COMPOSED_NAME));
    assert.notEqual(portfolioNameKey('Main'), portfolioNameKey('Main 2'));
  });
});
