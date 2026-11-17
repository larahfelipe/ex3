import { Pencil, Trash2 } from 'lucide-react';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl } from '@/test/intl';

import { IconButton } from './icon-button';

describe('an icon button', () => {
  it('is named by its label, with the icon hidden from assistive technology', () => {
    const markup = renderWithIntl(
      <IconButton icon={Pencil} label="Editar conta" />
    );

    assert.match(
      markup,
      /^<button [^>]*type="button" aria-label="Editar conta"/
    );
    assert.match(markup, /<svg[^>]*aria-hidden="true"/);
    assert.doesNotMatch(markup, /title=/);
  });

  it('may name the item it acts on, keeping the label as the start of the name', () => {
    const markup = renderWithIntl(
      <IconButton
        icon={Trash2}
        variant="ghost-destructive"
        label="Excluir"
        aria-label="Excluir Nubank"
        aria-disabled
      />
    );

    assert.match(markup, /aria-label="Excluir Nubank"/);
    assert.match(markup, /aria-disabled="true"/);
    assert.match(markup, /text-destructive/);
  });
});
