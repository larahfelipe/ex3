import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import {
  DeferredSection,
  FormField,
  FormSection,
  OptionalFields
} from './form-field';

describe('form field', () => {
  it('marks an optional field after its label, with a space', () => {
    const markup = renderWithIntl(
      <FormField label="Observações" isOptional>
        {(control) => <input {...control} />}
      </FormField>
    );

    assert.equal(textOf(markup), 'Observações (opcional)');
    assert.doesNotMatch(markup, /required/);
  });

  it('leaves a required field’s label as given', () => {
    const markup = renderWithIntl(
      <FormField label="Descrição">
        {(control) => <input {...control} />}
      </FormField>
    );

    assert.equal(textOf(markup), 'Descrição');
    assert.match(markup, /required/);
  });

  it('marks an optional section once, not each field in it', () => {
    const markup = renderWithIntl(
      <FormSection title="Pagamento" isOptional>
        <FormField label="Conta" isOptional>
          {(control) => <input {...control} />}
        </FormField>
      </FormSection>
    );

    assert.ok(textOf(markup).startsWith('Pagamento · Opcional'));
    assert.doesNotMatch(textOf(markup), /\(opcional\)/);
  });

  it('leaves the mark to the Remove button of a detail added on request', () => {
    const remove = 'Remover';
    const markup = renderWithIntl(
      <OptionalFields>
        <FormField
          isOptional
          label="Desconto"
          action={<button type="button">{remove}</button>}
        >
          {(control) => <input {...control} />}
        </FormField>
      </OptionalFields>
    );

    assert.equal(textOf(markup), 'DescontoRemover');
    assert.doesNotMatch(markup, /required/);
  });
});

describe('deferred section', () => {
  const section = (
    props: Partial<Record<'isInitiallyRevealed' | 'hasError', boolean>>
  ) =>
    renderWithIntl(
      <DeferredSection
        title="Pagamento"
        revealLabel="Adicionar forma de pagamento"
        onReveal={() => undefined}
        {...props}
      >
        <FormField label="Conta" isOptional>
          {(control) => <input {...control} />}
        </FormField>
      </DeferredSection>
    );

  it('waits behind its button while it holds nothing', () => {
    const markup = section({});

    assert.equal(textOf(markup), 'Adicionar forma de pagamento');
    assert.doesNotMatch(markup, /<input/);
  });

  it('says beside its button what it holds', () => {
    const markup = renderWithIntl(
      <DeferredSection
        title="Mais detalhes"
        revealLabel="Mais detalhes"
        revealHint="Subcategoria e observações"
        onReveal={() => undefined}
      >
        <FormField label="Observações" isOptional>
          {(control) => <input {...control} />}
        </FormField>
      </DeferredSection>
    );
    const hintId = /aria-describedby="([^"]+)"/.exec(markup)?.[1];

    assert.ok(hintId !== undefined);
    assert.match(
      markup,
      new RegExp(`id="${hintId}"[^>]*>Subcategoria e observações<`)
    );
  });

  it('opens on what it already holds, or on an error in it', () => {
    for (const markup of [
      section({ isInitiallyRevealed: true }),
      section({ hasError: true })
    ]) {
      assert.ok(textOf(markup).startsWith('Pagamento · Opcional'));
      assert.match(markup, /<input/);
    }
  });
});
