import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { expenseOf } from '@/test/fixtures/finance-notifications';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { BillFacts, BillSummary } from './bill-dialogs';

const metricsOf = (markup: string) =>
  [
    ...markup.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/g)
  ].map(([, term, value]) => [textOf(term), textOf(value)]);

describe('a bill’s summary', () => {
  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date'],
      now: Date.parse('2026-11-16T15:00:00.000Z')
    });
  });

  afterEach(() => mock.timers.reset());

  it('leads with the amount and the due date, then the category and how it is paid', () => {
    const expense = expenseOf({
      id: 'bill-1',
      dueDate: '2026-11-14',
      status: 'OVERDUE',
      settledAmount: '500.00',
      outstandingAmount: '1000.00',
      paymentMethod: 'CREDIT_CARD',
      originalDueDate: '2026-11-10',
      creditCardId: 'card-1',
      creditCard: {
        id: 'card-1',
        name: 'Nubank',
        brand: 'MASTERCARD',
        lastFourDigits: '1234',
        closingDay: 3,
        dueDay: 14,
        deletedAt: null
      },
      subcategory: 'Condomínio',
      account: 'Itaú',
      notes: 'Linha 1\nLinha 2'
    });
    const markup = renderWithIntl(<BillSummary expense={expense} />);

    assert.deepEqual(metricsOf(markup), [
      [
        'Valor',
        `${nbsp('R$ 1.500,00R$ 1.000,00')} em aberto · ${nbsp('R$ 500,00')} quitado`
      ],
      [
        'Pagamento no cartão',
        '14/11/2026Venceu há 2 diasConta vence em 10/11/2026'
      ],
      ['Categoria', 'Moradia · Condomínio'],
      ['Forma de pagamento', 'Cartão de créditoNubank•••• final 1234']
    ]);
    assert.match(
      markup,
      /<span class="[^"]*text-negative[^"]*">Venceu há 2 dias/
    );

    const facts = renderWithIntl(<BillFacts expense={expense} />);

    assert.deepEqual(metricsOf(facts), [
      ['Conta bancária ou cartão', 'Itaú'],
      ['Observações', 'Linha 1\nLinha 2']
    ]);
    assert.match(facts, /<h3 id="[^"]+"[^>]*>Detalhes<\/h3>/);
  });

  it('marks a missing payment method and leaves out the details never given', () => {
    const markup = renderWithIntl(
      <BillSummary
        expense={expenseOf({ id: 'bill-2', dueDate: '2026-11-20' })}
      />
    );

    assert.deepEqual(metricsOf(markup), [
      ['Valor', nbsp('R$ 1.500,00')],
      ['Vencimento', '20/11/2026Vence em 4 dias'],
      ['Categoria', 'Moradia'],
      ['Forma de pagamento', '-Indisponível']
    ]);
    assert.doesNotMatch(markup, /text-negative/);
    assert.equal(
      renderWithIntl(
        <BillFacts
          expense={expenseOf({ id: 'bill-2', dueDate: '2026-11-20' })}
        />
      ),
      ''
    );
  });

  it('tells when a paid bill was settled, with no distance to its due date', () => {
    const markup = renderWithIntl(
      <BillSummary
        expense={expenseOf({
          id: 'bill-3',
          dueDate: '2026-11-10',
          status: 'PAID',
          settledAmount: '1500.00',
          outstandingAmount: '0.00',
          settledOn: '2026-11-09',
          paymentMethod: 'PIX'
        })}
      />
    );

    assert.deepEqual(metricsOf(markup), [
      ['Valor', `${nbsp('R$ 1.500,00')}Quitada em 09/11/2026`],
      ['Vencimento', '10/11/2026'],
      ['Categoria', 'Moradia'],
      ['Forma de pagamento', 'Pix']
    ]);
  });
});
