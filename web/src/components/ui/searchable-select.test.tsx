import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { optionsMatching, SearchableSelect } from './searchable-select';

const CATEGORIES = [
  { value: 'HOUSING', label: 'Moradia' },
  { value: 'HEALTH', label: 'Saúde' },
  { value: 'EDUCATION', label: 'Educação' }
];

const valuesMatching = (query: string) =>
  optionsMatching(CATEGORIES, query).map(({ value }) => value);

describe('searchable select', () => {
  it('finds an option by any part of its label, whatever the case or the accents', () => {
    assert.deepEqual(valuesMatching('saude'), ['HEALTH']);
    assert.deepEqual(valuesMatching('CAÇÃO'), ['EDUCATION']);
    assert.deepEqual(valuesMatching(' radi '), ['HOUSING']);
    assert.deepEqual(valuesMatching('transporte'), []);
  });

  it('finds an option by what its description lists, too', () => {
    const described = [
      {
        value: 'UTILITIES',
        label: 'Contas da casa',
        description: 'Luz, água, internet'
      },
      {
        value: 'FINANCIAL',
        label: 'Financeiro',
        description: 'Impostos, seguros'
      }
    ];
    const valuesDescribedAs = (query: string) =>
      optionsMatching(described, query).map(({ value }) => value);

    assert.deepEqual(valuesDescribedAs('agua'), ['UTILITIES']);
    assert.deepEqual(valuesDescribedAs('Seguro'), ['FINANCIAL']);
    assert.deepEqual(valuesDescribedAs('financ'), ['FINANCIAL']);
  });

  it('lists every option until something is typed', () => {
    assert.deepEqual(valuesMatching(''), ['HOUSING', 'HEALTH', 'EDUCATION']);
    assert.deepEqual(valuesMatching('   '), ['HOUSING', 'HEALTH', 'EDUCATION']);
  });

  it('closes on the chosen option and posts its value under the name', () => {
    const markup = renderWithIntl(
      <SearchableSelect
        name="category"
        value="HEALTH"
        options={CATEGORIES}
        onValueChange={() => undefined}
      />
    );

    assert.match(markup, /role="combobox"/);
    assert.match(markup, /aria-haspopup="listbox"/);
    assert.match(markup, /aria-expanded="false"/);
    assert.match(
      markup,
      /<input type="hidden" name="category" value="HEALTH"\/>/
    );
    assert.doesNotMatch(markup, / data-placeholder=/);
    assert.equal(textOf(markup), 'Saúde');
  });

  it('shows the placeholder while nothing is chosen', () => {
    const markup = renderWithIntl(
      <SearchableSelect
        value=""
        placeholder="Todas"
        options={CATEGORIES}
        onValueChange={() => undefined}
      />
    );

    assert.match(markup, / data-placeholder="true"/);
    assert.equal(textOf(markup), 'Todas');
  });
});
