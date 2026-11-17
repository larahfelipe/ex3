import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import {
  PasswordStrength,
  passwordStrengthOf,
  usePasswordStrengthAnnouncement
} from './password-strength';

const EMAIL = 'mariana@exemplo.com';

const levelOf = (password: string) => passwordStrengthOf(password, EMAIL).level;

describe('password strength', () => {
  it('rates a password weak while it misses a requirement or follows a guessable pattern', () => {
    assert.equal(levelOf(''), 'empty');
    assert.equal(levelOf('tomate'), 'weak');
    assert.equal(levelOf('mariana-azul-2026'), 'weak');
    assert.equal(levelOf('Senha-forte-99'), 'weak');
    assert.equal(levelOf('tomate-azul-zzzz'), 'weak');
    assert.equal(levelOf('chave-1234-verde'), 'weak');
  });

  it('raises the level with length first and variety of characters second', () => {
    assert.equal(levelOf('tomate-azul'), 'fair');
    assert.equal(levelOf('Tom@te7x'), 'good');
    assert.equal(levelOf('tomate e cebola'), 'good');
    assert.equal(levelOf('correto-cavalo-bateria'), 'strong');
    assert.equal(levelOf('Tomate-azul-7'), 'strong');
  });

  it('meets the email rule without an email to compare against', () => {
    assert.deepEqual(
      passwordStrengthOf('mariana-azul').requirements.map(({ isMet }) => isMet),
      [true, true]
    );
  });

  it('fills one cell per level, one after another, and names the level for assistive technology', () => {
    const markup = renderWithIntl(
      <PasswordStrength password="Tom@te7x" email={EMAIL} />
    );

    assert.match(
      markup,
      /<div role="meter" aria-label="Força da senha" aria-valuemin="0" aria-valuemax="4" aria-valuenow="3" aria-valuetext="Boa"/
    );
    assert.deepEqual(
      Array.from(
        markup.matchAll(
          /motion-safe:delay-\(--fill-delay\) (scale-x-\d+) bg-positive" style="[^"]*--fill-delay:(\d+)ms"/g
        ),
        ([, scale, delay]) => `${scale} ${delay}`
      ),
      ['scale-x-100 0', 'scale-x-100 30', 'scale-x-100 60', 'scale-x-0 0']
    );
    assert.match(markup, /<p aria-live="polite" class="sr-only"><\/p>/);
  });

  it('checks off each requirement, stating it in text', () => {
    const items = (password: string) =>
      [
        ...renderWithIntl(
          <PasswordStrength password={password} email={EMAIL} />
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

  it('shows the guessable hint only for a guessable pattern', () => {
    const hintOf = (password: string) =>
      /<span class="whitespace-nowrap text-warning (opacity-\d+)"[^>]*>Fácil de adivinhar<\/span>/.exec(
        renderWithIntl(<PasswordStrength password={password} email={EMAIL} />)
      )?.[1];

    assert.equal(hintOf('qwerty-azul'), 'opacity-100');
    assert.equal(hintOf('tomate-azul'), 'opacity-0');
  });

  it('announces the level, a guessable pattern and the requirements still missing', () => {
    const Announcement = ({ password }: { password: string }) =>
      usePasswordStrengthAnnouncement(passwordStrengthOf(password, EMAIL));

    assert.equal(renderWithIntl(<Announcement password="" />), '');
    assert.equal(
      renderWithIntl(<Announcement password="mariana" />),
      'Força da senha: Fraca. Requisitos não atendidos: Pelo menos 8 caracteres e Não contém seu e-mail.'
    );
    assert.equal(
      renderWithIntl(<Announcement password="qwerty-azul" />),
      'Força da senha: Fraca. É um padrão fácil de adivinhar. Todos os requisitos atendidos.'
    );
    assert.equal(
      renderWithIntl(
        <Announcement password="correto-cavalo-bateria" />,
        'en-US'
      ),
      'Password strength: Strong. All requirements met.'
    );
  });
});
