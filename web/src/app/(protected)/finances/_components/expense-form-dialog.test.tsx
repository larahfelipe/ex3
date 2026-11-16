import type { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translatorOf } from '@/i18n/translator';
import { renderWithIntl, textOf } from '@/test/intl';

import { NO_CARD } from './credit-card-fields';
import {
  expenseChangesOf,
  expenseFormSchemaFor,
  newBillOf
} from './expense-form-dialog';
import { EMPTY_DESCRIPTION_FORM } from './finance-form';
import { PaidOnShortcuts } from './payment-form-dialog';

const t = translatorOf('pt-BR', 'validation');

const TODAY = '2026-11-11';

const schema = expenseFormSchemaFor(TODAY, t);

const BILL = {
  ...EMPTY_DESCRIPTION_FORM,
  description: 'Conta de luz',
  category: 'UTILITIES',
  amount: '180.4',
  currency: 'BRL',
  dueDate: '2026-11-20',
  creditCardId: NO_CARD,
  repeats: false,
  frequency: 'MONTHLY',
  amountKind: 'variable',
  endMode: 'date',
  endDate: ''
} as const;

const issuesOf = (input: Partial<Record<keyof typeof BILL, unknown>>) =>
  (schema.safeParse({ ...BILL, ...input }).error?.issues ?? []).map(
    ({ path, message }) => [path.join('.'), message]
  );

describe('a new bill', () => {
  it('asks nothing of a recurrence it does not use, however it was left', () => {
    assert.deepEqual(issuesOf({}), []);
    assert.deepEqual(issuesOf({ dueDate: '2024-01-10' }), []);
  });

  it('checks the recurrence once it repeats, from its due date', () => {
    assert.deepEqual(issuesOf({ repeats: true }), [
      ['endDate', 'Selecione uma data']
    ]);
    assert.deepEqual(issuesOf({ repeats: true, endDate: '2026-11-19' }), [
      ['endDate', 'Escolha uma data igual ou posterior ao primeiro vencimento']
    ]);
    assert.deepEqual(
      issuesOf({ repeats: true, endMode: 'never', dueDate: '2025-10-31' }),
      [['dueDate', 'Escolha uma data nos últimos 12 meses ou depois']]
    );
  });

  it('ends a repeating bill today or later, even when it started earlier', () => {
    const repeating = { repeats: true, dueDate: '2026-11-01' };

    assert.deepEqual(issuesOf({ ...repeating, endDate: '2026-11-10' }), [
      ['endDate', 'Escolha hoje ou uma data posterior']
    ]);
    assert.deepEqual(issuesOf({ ...repeating, endDate: TODAY }), []);
    assert.deepEqual(issuesOf({ ...repeating, endDate: '2031-03-31' }), []);
  });

  it('is added as itself while it does not repeat', () => {
    const draft = schema.parse(BILL);

    assert.deepEqual(newBillOf(draft), {
      kind: 'bill',
      bill: {
        description: 'Conta de luz',
        category: 'UTILITIES',
        subcategory: null,
        paymentMethod: null,
        account: null,
        notes: null,
        amount: '180.4',
        currency: 'BRL',
        dueDate: '2026-11-20',
        creditCardId: null
      }
    });
  });

  it('is added as a recurring expense whose first bill is due on its due date', () => {
    const repeating = (input: Partial<Record<keyof typeof BILL, unknown>>) =>
      newBillOf(schema.parse({ ...BILL, repeats: true, ...input }));

    assert.deepEqual(repeating({ endDate: '2027-11-20' }), {
      kind: 'series',
      series: {
        description: 'Conta de luz',
        category: 'UTILITIES',
        subcategory: null,
        paymentMethod: null,
        account: null,
        notes: null,
        amount: '180.4',
        currency: 'BRL',
        creditCardId: null,
        frequency: 'MONTHLY',
        startDate: '2026-11-20',
        isVariable: true,
        endDate: '2027-11-20'
      }
    });

    const open = repeating({
      endMode: 'never',
      endDate: '2027-11-20',
      amountKind: 'fixed'
    });

    assert.equal(open.kind, 'series');
    assert.equal(open.kind === 'series' && open.series.endDate, null);
    assert.equal(open.kind === 'series' && open.series.isVariable, false);
  });

  it('is charged to the card chosen while it is paid by credit card, repeating or not', () => {
    const charged = (input: Partial<Record<keyof typeof BILL, unknown>>) =>
      newBillOf(
        schema.parse({
          ...BILL,
          paymentMethod: 'CREDIT_CARD',
          creditCardId: 'card-1',
          ...input
        })
      );
    const cardOf = (newBill: ReturnType<typeof newBillOf>) =>
      newBill.kind === 'bill'
        ? newBill.bill.creditCardId
        : newBill.series.creditCardId;

    assert.equal(cardOf(charged({})), 'card-1');
    assert.equal(
      cardOf(charged({ repeats: true, endMode: 'never' })),
      'card-1'
    );
    assert.equal(cardOf(charged({ creditCardId: NO_CARD })), null);
    assert.equal(cardOf(charged({ paymentMethod: 'PIX' })), null);
  });
});

describe('an edited bill', () => {
  it('sends its own due date with the card, and lets the card go with another method', () => {
    const changesOf = (input: Partial<Record<keyof typeof BILL, unknown>>) =>
      expenseChangesOf(schema.parse({ ...BILL, ...input }), {
        kind: 'ONE_TIME'
      });

    assert.deepEqual(
      changesOf({ paymentMethod: 'CREDIT_CARD', creditCardId: 'card-1' }),
      {
        amount: '180.4',
        dueDate: '2026-11-20',
        creditCardId: 'card-1',
        description: 'Conta de luz',
        category: 'UTILITIES',
        subcategory: null,
        paymentMethod: 'CREDIT_CARD',
        account: null,
        notes: null
      }
    );
    assert.equal(
      changesOf({ paymentMethod: 'BOLETO', creditCardId: 'card-1' })
        .creditCardId,
      null
    );
  });

  it('leaves the card of an installment to its plan', () => {
    const changes = expenseChangesOf(
      schema.parse({
        ...BILL,
        paymentMethod: 'CREDIT_CARD',
        creditCardId: NO_CARD
      }),
      { kind: 'INSTALLMENT' }
    );

    assert.equal('creditCardId' in changes, false);
    assert.equal(changes.paymentMethod, 'CREDIT_CARD');
  });
});

const Shortcuts: FC<Record<'paidOn' | 'dueDate', string>> = ({
  paidOn,
  dueDate
}) => {
  const methods = useForm({ defaultValues: { paidOn } });

  return (
    <FormProvider {...methods}>
      <PaidOnShortcuts dueDate={dueDate} today={TODAY} />
    </FormProvider>
  );
};

const pressedOf = (markup: string) =>
  [...markup.matchAll(/<button[^>]*aria-pressed="true"[^>]*>(.*?)<\/button>/g)]
    .map(([, label]) => textOf(label ?? ''))
    .join();

describe('a payment’s day', () => {
  it('offers the due date once it has passed, beside today, and marks the one chosen', () => {
    const markup = renderWithIntl(
      <Shortcuts paidOn="2026-11-05" dueDate="2026-11-05" />
    );

    assert.match(markup, /role="group" aria-label="Datas rápidas"/);
    assert.equal(textOf(markup), 'HojeVencimento (05/11/2026)');
    assert.equal(pressedOf(markup), 'Vencimento (05/11/2026)');
  });

  it('offers only today while the bill is not yet due, since a payment cannot be ahead', () => {
    for (const dueDate of [TODAY, '2026-12-01']) {
      const markup = renderWithIntl(
        <Shortcuts paidOn={TODAY} dueDate={dueDate} />
      );

      assert.equal(textOf(markup), 'Hoje');
      assert.equal(pressedOf(markup), 'Hoje');
    }
  });

  it('marks neither while another day is chosen', () => {
    const markup = renderWithIntl(
      <Shortcuts paidOn="2026-11-01" dueDate="2026-10-30" />
    );

    assert.equal(pressedOf(markup), '');
  });
});
