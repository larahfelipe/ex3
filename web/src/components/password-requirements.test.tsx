import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { PasswordRequirements } from './password-requirements';

describe('password requirements', () => {
  it('lists the rules before anything is typed', () => {
    assert.equal(
      textOf(renderWithIntl(<PasswordRequirements />)),
      'Pelo menos 8 caracteresNão contém seu e-mail'
    );
  });

  it('says which rule each password meets', () => {
    const items = (password: string) =>
      [
        ...renderWithIntl(
          <PasswordRequirements
            password={password}
            email="mariana@exemplo.com"
          />
        ).matchAll(/<li[^>]*>(.*?)<\/li>/g)
      ].map(([, item]) => textOf(item ?? ''));

    assert.deepEqual(items(''), [
      'Não atendido: Pelo menos 8 caracteres',
      'Não atendido: Não contém seu e-mail'
    ]);
    assert.deepEqual(items('mariana-senha-2026'), [
      'Atendido: Pelo menos 8 caracteres',
      'Não atendido: Não contém seu e-mail'
    ]);
    assert.deepEqual(items('correto-cavalo-bateria'), [
      'Atendido: Pelo menos 8 caracteres',
      'Atendido: Não contém seu e-mail'
    ]);
  });
});
