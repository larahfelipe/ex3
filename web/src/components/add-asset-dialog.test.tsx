import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translatorOf } from '@/i18n/translator';

import { noMatchMessageOf } from './add-asset-dialog';

const t = translatorOf('pt-BR', 'investments.assets.add');

describe('asset search', () => {
  it('tells a ticker nothing lists from a name no tracked instrument has', () => {
    assert.equal(
      noMatchMessageOf('PETR9', 'SEARCHED', t),
      'Nada está listado como “PETR9”. Confira o ticker, como PETR4, AAPL ou BTC.'
    );
    assert.match(
      noMatchMessageOf('PETROBRAS', 'SKIPPED', t),
      /^Nenhum instrumento que você acompanha corresponde a “PETROBRAS”/
    );
  });

  it('does not send a ticker back to the ticker search while the market is out', () => {
    assert.equal(
      noMatchMessageOf('PETR9', 'UNAVAILABLE', t),
      'Nenhum instrumento encontrado'
    );
  });
});
