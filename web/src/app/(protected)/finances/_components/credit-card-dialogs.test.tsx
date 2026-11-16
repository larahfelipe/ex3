import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translatorOf } from '@/i18n/translator';

import { creditCardFormSchemaFor } from './credit-card-dialogs';

const schema = creditCardFormSchemaFor(translatorOf('pt-BR', 'validation'));

const CARD = {
  name: 'Nubank',
  lastFourDigits: '1234',
  brand: 'MASTERCARD',
  closingDay: '3',
  dueDay: '10'
} as const;

const issuesOf = (input: Partial<Record<keyof typeof CARD, unknown>>) =>
  (schema.safeParse({ ...CARD, ...input }).error?.issues ?? []).map(
    ({ path, message }) => [path.join('.'), message]
  );

describe('a credit card', () => {
  it('is saved with its days as numbers', () => {
    assert.deepEqual(schema.parse({ ...CARD, name: '  Nubank ' }), {
      name: 'Nubank',
      lastFourDigits: '1234',
      brand: 'MASTERCARD',
      closingDay: 3,
      dueDay: 10
    });
  });

  it('refuses a name holding a card number, however it is grouped', () => {
    for (const name of [
      'Nubank 4111111111111111',
      'Visa 4111 1111 1111 1111',
      '4111-1111-1111-1111'
    ])
      assert.deepEqual(issuesOf({ name }), [
        ['name', 'Não inclua o número do cartão no nome']
      ]);

    assert.deepEqual(issuesOf({ name: 'Cartão 2026' }), []);
  });

  it('asks for exactly the last four digits', () => {
    for (const lastFourDigits of ['123', '12345', ''])
      assert.deepEqual(issuesOf({ lastFourDigits }), [
        ['lastFourDigits', 'Informe exatamente os 4 últimos dígitos']
      ]);
  });

  it('asks for a closing day and a due day from 1 to 31, apart from each other', () => {
    assert.deepEqual(issuesOf({ closingDay: '' }), [
      ['closingDay', 'Informe um dia']
    ]);
    assert.deepEqual(issuesOf({ dueDay: '0' }), [
      ['dueDay', 'Informe um dia de 1 a 31']
    ]);
    assert.deepEqual(issuesOf({ closingDay: '32' }), [
      ['closingDay', 'Informe um dia de 1 a 31']
    ]);
    assert.deepEqual(issuesOf({ closingDay: '10', dueDay: '10' }), [
      ['dueDay', 'Escolha um dia de vencimento diferente do dia de fechamento']
    ]);
  });
});
