import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';

import { translatorOf } from '@/i18n/translator';
import { emailSchemaFor, newPasswordSchemaFor } from '@/lib/account-schema';

import {
  optionalPositiveMoneyFieldFor,
  positiveMoneyFieldFor,
  requiredTextFieldFor,
  requireMinorUnitsOf
} from './finance-form';

const t = translatorOf('pt-BR', 'validation');

const shownIssueOf = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message ?? null;

describe('validation messages', () => {
  it('asks for an amount above zero', () => {
    const amount = positiveMoneyFieldFor(t);

    assert.equal(shownIssueOf(amount, ''), 'Informe um valor');
    assert.equal(shownIssueOf(amount, '0'), 'Informe um valor maior que zero');
    assert.equal(shownIssueOf(amount, '12.50'), null);
    assert.equal(shownIssueOf(optionalPositiveMoneyFieldFor(t), ''), null);
  });

  it('states the API column’s limits with grouped digits', () => {
    assert.equal(
      shownIssueOf(positiveMoneyFieldFor(t), '1e3'),
      'Use um número com até 20 dígitos inteiros e 18 casas decimais'
    );
  });

  it('states a text limit', () => {
    const description = requiredTextFieldFor(t, 1200);

    assert.equal(shownIssueOf(description, '  '), 'Preencha este campo');
    assert.equal(
      shownIssueOf(description, 'x'.repeat(1201)),
      'Use no máximo 1.200 caracteres'
    );
  });

  it('refuses an amount finer than the currency’s minor units, by its plural', () => {
    const amounts = z
      .object({ amount: z.string(), currency: z.string() })
      .superRefine(requireMinorUnitsOf(['amount'], t));

    assert.equal(
      shownIssueOf(amounts, { amount: '10.5', currency: 'JPY' }),
      'Valores em JPY não têm casas decimais'
    );
    assert.equal(
      shownIssueOf(amounts, { amount: '10.505', currency: 'BRL' }),
      'Valores em BRL têm no máximo 2 casas decimais'
    );
    assert.equal(
      shownIssueOf(amounts, { amount: '10.5', currency: 'BRL' }),
      null
    );
  });

  it('words the account fields', () => {
    assert.equal(shownIssueOf(emailSchemaFor(t), ''), 'Informe o e-mail');
    assert.equal(
      shownIssueOf(emailSchemaFor(t), 'ana'),
      'Informe um e-mail válido, como nome@exemplo.com'
    );
    assert.equal(
      shownIssueOf(newPasswordSchemaFor(t), 'curta'),
      'A senha deve ter pelo menos 8 caracteres'
    );
    assert.equal(
      shownIssueOf(newPasswordSchemaFor(t), 'aaaaaaaa'),
      'A senha não pode repetir um único caractere'
    );
  });
});
