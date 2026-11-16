import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOf } from '@/i18n/format';
import { translatorOf } from '@/i18n/translator';
import { renderWithIntl, textOf } from '@/test/intl';

import { NO_CARD, PlanCardNote } from './credit-card-fields';
import { EMPTY_DESCRIPTION_FORM } from './finance-form';
import {
  planChangesOf,
  planEditSchemaFor,
  planFormSchemaFor,
  planPayloadOf
} from './installment-plan-forms';

const t = translatorOf('pt-BR', 'validation');

const PLAN = {
  ...EMPTY_DESCRIPTION_FORM,
  description: 'Notebook',
  category: 'SHOPPING',
  currency: 'BRL',
  amountMode: 'total',
  amount: '3000',
  installmentCount: '10',
  frequency: 'MONTHLY',
  firstDueDate: '2026-12-05',
  principalAmount: '',
  creditCardId: NO_CARD
} as const;

const CARD = {
  id: 'card-1',
  name: 'Nubank',
  lastFourDigits: '1234',
  brand: 'MASTERCARD',
  closingDay: 3,
  dueDay: 10,
  deletedAt: null
} as const;

describe('a new installment plan', () => {
  const schema = planFormSchemaFor(t, formatOf('pt-BR'));
  const cardOf = (input: Partial<Record<keyof typeof PLAN, unknown>>) =>
    planPayloadOf(schema.parse({ ...PLAN, ...input })).creditCardId;

  it('is charged to the card chosen while it is paid by credit card', () => {
    assert.equal(
      cardOf({ paymentMethod: 'CREDIT_CARD', creditCardId: 'card-1' }),
      'card-1'
    );
    assert.equal(cardOf({ paymentMethod: 'CREDIT_CARD' }), null);
    assert.equal(
      cardOf({ paymentMethod: 'PIX', creditCardId: 'card-1' }),
      null
    );
    assert.equal(cardOf({}), null);
  });

  it('sends its amount as the total or per installment, beside the card', () => {
    const payload = planPayloadOf(
      schema.parse({
        ...PLAN,
        amountMode: 'installment',
        amount: '300',
        paymentMethod: 'CREDIT_CARD',
        creditCardId: 'card-1'
      })
    );

    assert.equal(
      'installmentAmount' in payload && payload.installmentAmount,
      '300'
    );
    assert.equal('totalAmount' in payload, false);
    assert.equal('amountMode' in payload, false);
    assert.equal(payload.creditCardId, 'card-1');
  });
});

describe('an edited installment plan', () => {
  const schema = planEditSchemaFor(t, 'BRL');
  const EDIT = {
    ...EMPTY_DESCRIPTION_FORM,
    description: 'Notebook',
    category: 'SHOPPING',
    principalAmount: '',
    creditCardId: NO_CARD
  } as const;
  const cardOf = (input: Partial<Record<keyof typeof EDIT, unknown>>) =>
    planChangesOf(schema.parse({ ...EDIT, ...input })).creditCardId;

  it('sends the card it is charged to, and lets it go with another method', () => {
    assert.equal(
      cardOf({ paymentMethod: 'CREDIT_CARD', creditCardId: 'card-1' }),
      'card-1'
    );
    assert.equal(
      cardOf({ paymentMethod: 'BOLETO', creditCardId: 'card-1' }),
      null
    );
    assert.equal(cardOf({ paymentMethod: 'CREDIT_CARD' }), null);
  });
});

describe('an installment’s card', () => {
  it('is shown as its plan’s, to be changed on the plan', () => {
    const markup = renderWithIntl(<PlanCardNote card={CARD} />);

    assert.match(markup, /role="img" aria-label="Mastercard"/);
    assert.equal(
      textOf(markup),
      'CartãoNubank•••• final 1234Definido no parcelamento: para trocar, edite o parcelamento.'
    );
  });
});
