import { Wallet } from 'lucide-react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { EmptyState } from './data-state';

describe('empty state', () => {
  it('opens a first run with its title, the way forward and the primary action', () => {
    const markup = renderWithIntl(
      <EmptyState
        icon={Wallet}
        title="Nenhuma carteira"
        message="Crie uma para começar."
        action={{ label: 'Criar carteira', onSelect: () => undefined }}
      />
    );

    assert.equal(
      textOf(markup),
      'Nenhuma carteiraCrie uma para começar.Criar carteira'
    );
    assert.match(markup, /<svg[^>]*aria-hidden="true"/);
    assert.match(markup, /bg-primary/);
  });

  it('keeps a section’s empty line compact, its action secondary', () => {
    const markup = renderWithIntl(
      <EmptyState
        message="Nada por aqui."
        action={{ label: 'Adicionar', onSelect: () => undefined }}
      />
    );

    assert.equal(textOf(markup), 'Nada por aqui.Adicionar');
    assert.doesNotMatch(markup, /border-dashed/);
    assert.doesNotMatch(markup, /<svg/);
  });
});
