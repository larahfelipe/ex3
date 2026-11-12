import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatOf } from '@/i18n/format';
import { translatorOf } from '@/i18n/translator';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { CategoryBars, MonthColumnChart } from './finance-charts';
import {
  describeEvent,
  dueDistanceOf,
  ExpenseStatusBadge,
  InstallmentProgress,
  originLabelOf,
  PlanStatusBadge,
  SeriesStatusBadge
} from './finance-display';
import { changeTextOf, totalsText } from './finance-summary';

const t = translatorOf('pt-BR', 'finances');
const format = formatOf('pt-BR');

const SERIES = [
  {
    key: 'paid',
    label: 'Pago',
    color: { bar: 'bg-chart-2', swatch: 'bg-chart-2' }
  },
  {
    key: 'owed',
    label: 'Em aberto',
    color: { bar: 'bg-chart-1', swatch: 'bg-chart-1' }
  }
] as const;

describe('finance history', () => {
  it('words an edit field by field, in the record’s currency', () => {
    assert.equal(
      describeEvent(
        {
          type: 'UPDATED',
          changes: {
            amount: { from: '100', to: '120.5' },
            category: { from: 'FOOD', to: 'HEALTH' },
            isVariable: { from: false, to: true },
            notes: { from: null, to: 'Plano anual' }
          }
        },
        'USD',
        t,
        format
      ),
      `valor: ${nbsp('US$ 100,00')} → ${nbsp('US$ 120,50')}; categoria: Alimentação → Saúde e bem-estar; valor variável: não → sim; observações: nenhum → Plano anual`
    );
  });

  it('names a category no longer offered as it was recorded', () => {
    assert.equal(
      describeEvent(
        {
          type: 'UPDATED',
          changes: { category: { from: 'INSURANCE', to: 'FINANCIAL' } }
        },
        'BRL',
        t,
        format
      ),
      'categoria: Seguros → Financeiro'
    );
  });

  it('words the day an edit takes effect', () => {
    assert.equal(
      describeEvent(
        {
          type: 'UPDATED',
          changes: {
            effectiveFrom: '2026-11-01',
            dueDate: { from: '2026-11-05', to: '2026-11-10' }
          }
        },
        'BRL',
        t,
        format
      ),
      'vencimento: 05/11/2026 → 10/11/2026, a partir de 01/11/2026'
    );
  });

  it('words a payment and the day it was made', () => {
    assert.equal(
      describeEvent(
        {
          type: 'PAYMENT_RECORDED',
          changes: { amount: '1234.5', paidOn: '2026-10-28' }
        },
        'BRL',
        t,
        format
      ),
      `${nbsp('R$ 1.234,50')} pago em 28/10/2026`
    );
  });

  it('counts the installments a reschedule replaces', () => {
    const rescheduled = (replaced: Array<number>) =>
      describeEvent(
        { type: 'RESCHEDULED', changes: { replaced, scheduled: [1, 2, 3] } },
        'BRL',
        t,
        format
      );

    assert.equal(
      rescheduled([]),
      'Nenhuma parcela em aberto substituída por 3'
    );
    assert.equal(rescheduled([1]), '1 parcela em aberto substituída por 3');
    assert.equal(
      rescheduled([1, 2]),
      '2 parcelas em aberto substituídas por 3'
    );
  });

  it('counts the occurrences a stopped series drops', () => {
    assert.equal(
      describeEvent(
        {
          type: 'CANCELLED',
          changes: {
            effectiveFrom: '2026-11-01',
            removedOccurrences: [1],
            cancelledOccurrences: [2]
          }
        },
        'BRL',
        t,
        format
      ),
      'Interrompida a partir de 01/11/2026; 2 ocorrências não pagas removidas'
    );
  });
});

describe('finance labels', () => {
  it('words how far a due date is', () => {
    assert.equal(dueDistanceOf('2026-10-28', '2026-10-28', t), 'Vence hoje');
    assert.equal(dueDistanceOf('2026-10-29', '2026-10-28', t), 'Vence amanhã');
    assert.equal(
      dueDistanceOf('2026-10-20', '2026-10-28', t),
      'Venceu há 8 dias'
    );
    assert.equal(dueDistanceOf('2026-02-30', '2026-10-28', t), null);
  });

  it('names where a bill comes from', () => {
    assert.equal(
      originLabelOf(
        { kind: 'INSTALLMENT', installmentNumber: 3, installmentCount: 12 },
        t
      ),
      'Parcela 3 de 12'
    );
    assert.equal(
      originLabelOf(
        { kind: 'RECURRING', installmentNumber: null, installmentCount: null },
        t
      ),
      'Recorrente'
    );
  });

  it('words a change against the last period without a sign', () => {
    const summary = translatorOf('pt-BR', 'finances.summary');

    assert.equal(
      changeTextOf(
        { amount: '-150.5', percent: '-0.1' },
        'BRL',
        'lastMonth',
        summary,
        format
      ),
      `${nbsp('R$ 150,50')} (10%) a menos que no mês passado`
    );
    assert.equal(
      changeTextOf(
        { amount: '20', percent: null },
        'EUR',
        'em set. de 2026',
        summary,
        format
      ),
      `${nbsp('€ 20,00')} a mais que em set. de 2026`
    );
    assert.equal(
      changeTextOf(
        { amount: '0', percent: '0' },
        'BRL',
        'lastMonth',
        summary,
        format
      ),
      'Igual ao mês passado'
    );
  });

  it('lists the totals of each currency apart, never summed', () => {
    assert.equal(
      totalsText(
        [
          { amount: '1234.56', currency: 'BRL' },
          { amount: '10', currency: 'USD' }
        ],
        format
      ),
      `${nbsp('R$ 1.234,56')} · ${nbsp('US$ 10,00')}`
    );
  });

  it('names every status', () => {
    const textsOf = (markup: string) => textOf(markup).trim();

    assert.equal(
      textsOf(renderWithIntl(<ExpenseStatusBadge status="OVERDUE" />)),
      'Vencida'
    );
    assert.equal(
      textsOf(renderWithIntl(<PlanStatusBadge status="COMPLETED" />)),
      'Concluído'
    );
    assert.equal(
      textsOf(renderWithIntl(<SeriesStatusBadge status="CANCELLED" />)),
      'Interrompida'
    );
  });

  it('reads the installments paid as progress', () => {
    const markup = renderWithIntl(<InstallmentProgress paid={3} count={12} />);

    assert.match(markup, /aria-label="Parcelas pagas"/);
    assert.match(markup, /aria-valuetext="3 de 12 pagas"/);
  });
});

describe('finance charts', () => {
  const chart = renderWithIntl(
    <MonthColumnChart
      title="Gastos por mês"
      currency="BRL"
      series={SERIES}
      layout="grouped"
      columns={[
        { month: '2026-09', values: { paid: '800', owed: '0' } },
        { month: '2026-10', values: { paid: '1234.5', owed: '310.25' } }
      ]}
    />
  );

  it('names each month’s figures for a screen reader', () => {
    assert.ok(
      chart.includes(
        `aria-label="out. de 2026: Pago ${nbsp('R$ 1.234,50')}, Em aberto ${nbsp('R$ 310,25')}"`
      )
    );
    assert.ok(
      chart.includes(
        `aria-label="set. de 2026: Pago ${nbsp('R$ 800,00')}, Em aberto ${nbsp('R$ 0,00')}"`
      )
    );
  });

  it('labels the axis and the months in Portuguese', () => {
    const element = (text: string) => `>${text}</span>`;

    assert.ok(chart.includes(element(nbsp('R$ 1,2 mil'))));
    assert.ok(chart.includes(element(nbsp('R$ 0'))));
    assert.ok(chart.includes(element('set.')));
    assert.ok(chart.includes(element('out.')));
    assert.ok(textOf(chart).includes('Mostrar tabela'));
  });

  it('writes each category’s amount and share', () => {
    const text = textOf(
      renderWithIntl(
        <CategoryBars
          currency="BRL"
          bars={[
            { key: 'FOOD', label: 'Alimentação', value: '750', share: '0.75' },
            { key: 'HEALTH', label: 'Saúde', value: '250', share: '0.25' }
          ]}
        />
      )
    );

    assert.ok(text.includes(nbsp('R$ 750,00')));
    assert.ok(text.includes('75%'));
    assert.ok(text.includes('25%'));
  });
});
