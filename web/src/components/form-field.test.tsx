import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderWithIntl, textOf } from '@/test/intl';

import { FormField, FormSection } from './form-field';

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
});
