import type { FC } from 'react';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { OptionalDetailButtons, useOptionalDetails } from './optional-details';

const DETAILS = ['discount', 'fees', 'notes'] as const;

type Detail = (typeof DETAILS)[number];

const Details: FC<
  Record<'initiallyShown' | 'required', ReadonlyArray<Detail>>
> = ({ initiallyShown, required }) => {
  const details = useOptionalDetails({
    details: DETAILS,
    initiallyShown: () => initiallyShown,
    required,
    focus: () => undefined,
    clear: () => undefined
  });

  return (
    <>
      {DETAILS.filter(details.isShown).map((detail) => (
        <input key={detail} name={detail} />
      ))}

      <OptionalDetailButtons
        label="Detalhes opcionais"
        details={details.hidden}
        labelOf={(detail) => `+${detail}`}
        onShow={details.show}
        buttonRefOf={details.addButtonRef}
      />
    </>
  );
};

const shownOf = (markup: string) =>
  [...markup.matchAll(/<input name="(\w+)"/g)].map(([, name]) => name);

describe('optional details', () => {
  it('wait behind a button each until something is in them', () => {
    const markup = renderWithIntl(
      <Details initiallyShown={['notes']} required={[]} />
    );

    assert.deepEqual(shownOf(markup), ['notes']);
    assert.match(markup, /role="group" aria-label="Detalhes opcionais"/);
    assert.equal(textOf(markup), '+discount+fees');
  });

  it('show a detail that holds an error, whatever was chosen', () => {
    const markup = renderWithIntl(
      <Details initiallyShown={[]} required={['fees']} />
    );

    assert.deepEqual(shownOf(markup), ['fees']);
    assert.equal(textOf(markup), '+discount+notes');
  });

  it('leave no empty group once every detail is shown', () => {
    const markup = renderWithIntl(
      <Details initiallyShown={['discount', 'notes']} required={['fees']} />
    );

    assert.deepEqual(shownOf(markup), ['discount', 'fees', 'notes']);
    assert.doesNotMatch(markup, /role="group"/);
  });
});
