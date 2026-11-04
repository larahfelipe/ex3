import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  PerformanceBenchmark,
  PortfolioPerformance
} from '@/app/api/v1/portfolio';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { PerformanceSeries } from './performance-chart';

const PERFORMANCE: Pick<
  PortfolioPerformance,
  'series' | 'baseCurrency' | 'summary'
> = {
  baseCurrency: 'BRL',
  series: [
    {
      date: '2026-10-01T00:00:00.000Z',
      value: '1000',
      investedValue: '1000',
      netContribution: '0',
      twr: '0'
    },
    {
      date: '2026-10-28T00:00:00.000Z',
      value: '1500',
      investedValue: '1400',
      netContribution: '400',
      twr: '0.1'
    }
  ],
  summary: {
    valueChange: '500',
    valueChangePercent: '0.5',
    netContribution: '400',
    twr: '0.1'
  }
};

const BENCHMARK: PerformanceBenchmark = {
  symbol: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  currency: 'USD',
  series: [
    { date: '2026-10-01T00:00:00.000Z', close: '500', twr: '0' },
    { date: '2026-10-28T00:00:00.000Z', close: '520', twr: '0.04' }
  ]
};

const sliderTextOf = (markup: string) =>
  markup.match(/aria-valuetext="([^"]*)"/)?.[1] ?? '';

const renderSeries = (
  metric: 'value' | 'return',
  benchmark?: PerformanceBenchmark
) =>
  renderWithIntl(
    <PerformanceSeries
      {...PERFORMANCE}
      benchmark={benchmark}
      metric={metric}
      period="no último mês"
      seriesLabel="Carteira"
    />
  );

describe('performance chart', () => {
  it('reads the value in money, with its change and the contributions in it', () => {
    const markup = renderSeries('value', BENCHMARK);
    const text = textOf(markup);

    assert.ok(text.includes(nbsp('R$ 1.500,00')));
    assert.ok(text.includes(nbsp('+R$ 500,00')));
    assert.ok(
      text.includes(`Inclui ${nbsp('+R$ 400,00')} em aportes líquidos`)
    );
    assert.match(markup, /aria-label="Valor em cada pregão"/);
    assert.ok(
      sliderTextOf(markup).endsWith(
        `${nbsp('R$ 1.500,00')}, com ${nbsp('R$ 1.400,00')} investidos`
      )
    );
    assert.doesNotMatch(text, /\+10%|Rentabilidade|VOO|S&amp;P|S&P/);
  });

  it('reads the return as a percentage, never as money', () => {
    const markup = renderSeries('return');
    const text = textOf(markup);

    assert.match(text, /\+10%/);
    assert.match(markup, /aria-label="Rentabilidade em cada pregão"/);
    assert.match(sliderTextOf(markup), /: \+10%$/);
    assert.doesNotMatch(text, /R\$|aportes/);
  });

  it('compares the return with the benchmark’s, converted to the base currency', () => {
    const markup = renderSeries('return', BENCHMARK);
    const text = textOf(markup);

    assert.match(text, /S&P 500 \(VOO\)\+4%/);
    assert.match(textOf(sliderTextOf(markup)), /\+10%; S&P 500 \(VOO\): \+4%$/);
    assert.match(text, /considera só a variação do preço, convertida para BRL/);
    assert.doesNotMatch(text, /R\$/);
  });

  it('says the benchmark cannot be compared when it has no point in the period', () => {
    const text = textOf(renderSeries('return', { ...BENCHMARK, series: [] }));

    assert.match(text, /Não é possível comparar com S&P 500 \(VOO\)/);
    assert.doesNotMatch(text, /convertida para BRL/);
  });
});
