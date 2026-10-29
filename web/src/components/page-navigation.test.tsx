import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translatorOf } from '@/i18n/translator';
import { renderWithIntl, textOf } from '@/test/intl';

import { PageNavigation } from './page-navigation';

const pageNavigation = (page: number, detail?: string) =>
  renderWithIntl(
    <PageNavigation
      label="Páginas de contas"
      page={page}
      totalPages={5}
      detail={detail}
      onPageChange={() => undefined}
    />
  );

describe('page navigation', () => {
  it('names the steps and the position', () => {
    const markup = pageNavigation(2);

    assert.match(markup, /aria-label="Páginas de contas"/);
    assert.equal(textOf(markup), 'AnteriorPágina 2 de 5Próxima');
  });

  it('adds the range shown to the position', () => {
    const range = translatorOf('pt-BR', 'bills')('range', {
      first: 21,
      last: 40,
      total: 1234
    });

    assert.match(textOf(pageNavigation(2, range)), /Página 2 de 5 · /);
    assert.ok(textOf(pageNavigation(2, range)).includes(range));
  });

  it('leaves the first page’s previous step unavailable', () => {
    const steps = [...pageNavigation(1).matchAll(/aria-disabled="(\w+)"/g)];

    assert.deepEqual(
      steps.map(([, disabled]) => disabled),
      ['true', 'false']
    );
  });
});
