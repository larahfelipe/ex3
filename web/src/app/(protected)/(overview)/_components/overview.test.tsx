import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  GetPortfolioAllocationResponseData,
  GetPortfolioIncomeResponseData,
  GetPortfolioOverviewResponseData,
  GetPortfolioPositionsResponseData,
  MarketDataStatus
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { DECIMAL_COLUMN, unitsOf } from '@/lib/decimal';
import { queryKeys } from '@/lib/react-query';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';
import { withQueryData } from '@/test/queries';
import type { DecimalString } from '@/types';

import {
  AllocationChart,
  concentrationOf,
  ringArcsOf
} from './allocation-chart';
import { GettingStarted, nextGettingStartedStage } from './getting-started';
import { IncomeSummary } from './income-summary';
import { PortfolioValueCard } from './portfolio-value-card';

const PORTFOLIO: Portfolio = {
  id: '6f1c2a4e-3b5d-4c7e-8f90-1a2b3c4d5e6f',
  name: 'Aposentadoria',
  baseCurrency: 'BRL',
  createdAt: '2026-01-02T12:00:00.000Z',
  updatedAt: '2026-01-02T12:00:00.000Z'
};

const ignore = () => undefined;

describe('allocation concentration', () => {
  const group = (label: string, allocation?: DecimalString) => ({
    key: label,
    label,
    ...(allocation !== undefined && { allocation }),
    color: { arc: 'stroke-chart-1', swatch: 'bg-chart-1' }
  });

  it('names the largest of a few groups', () => {
    assert.deepEqual(
      concentrationOf([group('PETR4', '0.6'), group('VALE3', '0.4')]),
      { label: 'PETR4', share: '0.6' }
    );
  });

  it('adds up exactly what the three largest of more groups hold', () => {
    const concentration = concentrationOf([
      group('PETR4', '0.4'),
      group('VALE3', '0.2'),
      group('ITUB4', '0.1'),
      group('WEGE3', '0.1'),
      group('BBAS3', '0.1'),
      group('ABEV3', '0.1')
    ]);

    assert.equal(concentration?.label, 'PETR4');
    assert.equal(concentration?.share, '0.4');
    assert.equal(
      unitsOf(concentration?.topShare ?? '0', DECIMAL_COLUMN.SCALE),
      unitsOf('0.7', DECIMAL_COLUMN.SCALE)
    );
  });

  it('says nothing of a single group or of one without a share', () => {
    assert.equal(concentrationOf([group('PETR4', '1')]), null);
    assert.equal(
      concentrationOf([group('PETR4', '0.6'), group('VALE3')]),
      null
    );
  });
});

describe('allocation ring', () => {
  const arcClassesOf = (markup: string) =>
    [...markup.matchAll(/<circle [^>]*class="(stroke-chart-\d+)"/g)].map(
      ([, className]) => className
    );

  const renderAllocation = (
    allocation: Partial<GetPortfolioAllocationResponseData>
  ) =>
    renderWithIntl(
      withQueryData(
        [
          [
            queryKeys.allocation(PORTFOLIO.id),
            {
              baseCurrency: 'BRL',
              byType: [],
              bySector: [],
              byCurrency: [],
              ...allocation
            }
          ]
        ],
        <AllocationChart portfolio={PORTFOLIO} />
      )
    );

  it('lays the arcs end to end from the first group, without the groups that hold nothing', () => {
    assert.deepEqual(
      ringArcsOf([
        {
          key: 'PETR4',
          allocation: '0.6',
          color: { arc: 'stroke-chart-1', swatch: 'bg-chart-1' }
        },
        {
          key: 'VALE3',
          allocation: '0.25',
          color: { arc: 'stroke-chart-2', swatch: 'bg-chart-2' }
        },
        {
          key: 'ITUB4',
          allocation: '0',
          color: { arc: 'stroke-chart-3', swatch: 'bg-chart-3' }
        },
        {
          key: 'WEGE3',
          allocation: '0.15',
          color: { arc: 'stroke-chart-4', swatch: 'bg-chart-4' }
        },
        {
          key: 'BBAS3',
          color: { arc: 'stroke-chart-5', swatch: 'bg-chart-5' }
        }
      ]),
      [
        { key: 'PETR4', className: 'stroke-chart-1', start: 0, length: 60 },
        { key: 'VALE3', className: 'stroke-chart-2', start: 60, length: 25 },
        { key: 'WEGE3', className: 'stroke-chart-4', start: 85, length: 15 }
      ]
    );
  });

  it('starts each round-capped arc half a thickness late, sweeps them in and puts the total in the middle', () => {
    const markup = renderAllocation({
      totalValue: '1234567.89',
      byAsset: [
        {
          symbol: 'VALE3',
          name: 'Vale',
          marketValue: '370370.37',
          allocation: '0.3'
        },
        {
          symbol: 'PETR4',
          name: 'Petrobras',
          marketValue: '864197.52',
          allocation: '0.7'
        }
      ],
      byType: [{ type: 'STOCK', marketValue: '1234567.89', allocation: '1' }]
    });
    const [, maskId] = /<mask id="([^"]+)"/.exec(markup) ?? [];

    assert.ok(maskId);
    assert.match(
      markup,
      new RegExp(`<g mask="url\\(#${maskId}\\)"[^>]*stroke-linecap="round"`)
    );
    assert.match(
      markup,
      /<mask [^>]*><circle [^>]*stroke-width="4.5" stroke-linecap="round" stroke-dasharray="100 0" stroke-dashoffset="-2.25" class="animate-ring-sweep" style="--ring-length:100"><\/circle><circle [^>]*stroke-width="5" stroke-linecap="butt" stroke-dasharray="100 0" stroke-dashoffset="-2.25" class="animate-ring-sweep"/
    );
    assert.deepEqual(arcClassesOf(markup), [
      'stroke-chart-1',
      'stroke-chart-2',
      'stroke-chart-1'
    ]);
    assert.match(
      markup,
      /stroke-dasharray="30 70" stroke-dashoffset="-72.25" class="stroke-chart-2"/
    );
    assert.match(
      markup,
      /stroke-dasharray="2.25 97.75" stroke-dashoffset="-2.25" class="stroke-chart-1"/
    );
    assert.ok(
      textOf(markup).includes(
        `Valor total${nbsp('R$ 1,2 mi')}${nbsp('R$ 1.234.567,89')}`
      )
    );
  });

  it('leaves the ring empty and the total unavailable while a position has no price', () => {
    const markup = renderAllocation({
      byAsset: [{ symbol: 'PETR4', name: 'Petrobras' }],
      byType: [{ type: 'STOCK' }]
    });

    assert.deepEqual(arcClassesOf(markup), []);
    assert.ok(textOf(markup).includes('Valor total-Indisponível'));
  });
});

describe('recorded income', () => {
  const renderIncome = (income: GetPortfolioIncomeResponseData) =>
    textOf(
      renderWithIntl(
        withQueryData(
          [[queryKeys.income(PORTFOLIO.id), income]],
          <IncomeSummary portfolio={PORTFOLIO} />
        )
      )
    );

  it('shows each type net, over the last 12 months and in all, without a heading for a single currency', () => {
    const text = renderIncome({
      trailingFrom: '2025-10-29T00:00:00.000Z',
      byCurrency: [
        {
          currency: 'BRL',
          total: '83',
          trailingTotal: '49',
          byType: [
            { type: 'DIVIDEND', total: '49', trailingTotal: '49' },
            { type: 'JCP', total: '34', trailingTotal: '0' }
          ]
        }
      ]
    });

    assert.match(text, /Proventos registrados/);
    assert.ok(text.includes(`Dividendo${nbsp('R$ 49,00')}${nbsp('R$ 49,00')}`));
    assert.ok(text.includes(`JCP${nbsp('R$ 0,00')}${nbsp('R$ 34,00')}`));
    assert.ok(text.includes(nbsp('R$ 83,00')));
    assert.doesNotMatch(text, /Em Real brasileiro/);
    assert.match(text, /não uma projeção\.$/);
  });

  it('keeps each currency under its own heading and says none is converted', () => {
    const text = renderIncome({
      trailingFrom: '2025-10-29T00:00:00.000Z',
      byCurrency: [
        {
          currency: 'BRL',
          total: '10',
          trailingTotal: '10',
          byType: [{ type: 'DIVIDEND', total: '10', trailingTotal: '10' }]
        },
        {
          currency: 'USD',
          total: '2.5',
          trailingTotal: '0',
          byType: [{ type: 'DIVIDEND', total: '2.5', trailingTotal: '0' }]
        }
      ]
    });

    assert.match(text, /Em Real brasileiro \(BRL\)/);
    assert.match(text, /Em Dólar americano \(USD\)/);
    assert.ok(text.includes(nbsp('US$ 2,50')));
    assert.match(text, /sem conversão/);
  });

  it('explains what counts as income while none is recorded', () => {
    const text = renderIncome({
      trailingFrom: '2025-10-29T00:00:00.000Z',
      byCurrency: []
    });

    assert.match(text, /Ainda não há proventos registrados/);
  });
});

describe('portfolio value', () => {
  const COMPLETE: MarketDataStatus = {
    valuedPositionCount: 2,
    missingQuotes: [],
    missingRates: [],
    isFallback: false,
    isStale: false
  };

  const renderValue = (
    overview: Partial<GetPortfolioOverviewResponseData> &
      Pick<GetPortfolioOverviewResponseData, 'marketData'>
  ) =>
    textOf(
      renderWithIntl(
        withQueryData(
          [
            [
              queryKeys.portfolioOverview(PORTFOLIO.id),
              {
                baseCurrency: 'BRL',
                heldPositionCount: 2,
                quotedAt: '2026-10-28T20:00:00.000Z',
                ...overview
              }
            ]
          ],
          <PortfolioValueCard portfolio={PORTFOLIO} />
        )
      )
    );

  it('shows the totals without a notice when every position is priced', () => {
    const text = renderValue({
      totalValue: '5000',
      investedValue: '4000',
      profitLoss: '1000',
      profitLossPercent: '0.25',
      marketData: COMPLETE
    });

    assert.ok(text.includes(nbsp('R$ 5.000,00')));
    assert.doesNotMatch(
      text,
      /Só foi possível avaliar|últimos recebidos|mais de quatro dias/
    );
  });

  it('says which price is missing and that the totals cannot be calculated', () => {
    const text = renderValue({
      marketData: {
        ...COMPLETE,
        valuedPositionCount: 1,
        missingQuotes: [{ symbol: 'VALE3', reason: 'unavailable' }]
      }
    });

    assert.match(text, /1 de 2 posições/);
    assert.match(text, /VALE3/);
  });

  it('warns about fallback prices even when the totals are complete', () => {
    const text = renderValue({
      totalValue: '5000',
      investedValue: '4000',
      marketData: { ...COMPLETE, isFallback: true }
    });

    assert.ok(text.includes(nbsp('R$ 5.000,00')));
    assert.match(text, /alguns preços são os últimos recebidos/);
    assert.doesNotMatch(text, /Só foi possível avaliar/);
  });

  it('warns that the latest prices are old even when the totals are complete', () => {
    const text = renderValue({
      totalValue: '5000',
      investedValue: '4000',
      marketData: { ...COMPLETE, isStale: true }
    });

    assert.ok(text.includes(nbsp('R$ 5.000,00')));
    assert.match(text, /mais de quatro dias/);
    assert.doesNotMatch(text, /Só foi possível avaliar|últimos recebidos/);
  });

  it('keeps the value of positions all priced when only the rate of a cost is missing', () => {
    const text = renderValue({
      totalValue: '5000',
      marketData: {
        ...COMPLETE,
        missingRates: [{ currency: 'USD', reason: 'unavailable' }]
      }
    });

    assert.ok(text.includes(nbsp('R$ 5.000,00')));
    assert.match(text, /Todas as posições puderam ser avaliadas em BRL/);
    assert.match(text, /câmbio de USD para BRL/);
    assert.doesNotMatch(text, /Só foi possível avaliar/);
  });
});

describe('getting started', () => {
  const HELD_ASSET: GetPortfolioPositionsResponseData = {
    items: [
      {
        baseCurrency: 'BRL',
        symbol: 'PETR4',
        name: 'Petrobras',
        quantity: '0'
      }
    ],
    total: 1,
    page: 1,
    pageSize: 1,
    totalPages: 1
  };

  const renderGuideMarkup = (
    positions?: GetPortfolioPositionsResponseData,
    isComplete = false
  ) =>
    renderWithIntl(
      withQueryData(
        positions
          ? [
              [
                queryKeys.positions(PORTFOLIO.id, { page: 1, pageSize: 1 }),
                positions
              ]
            ]
          : [],
        <GettingStarted
          portfolio={PORTFOLIO}
          isComplete={isComplete}
          onAddAsset={ignore}
          onDismiss={ignore}
          onRecordTransaction={ignore}
        />
      )
    );

  const renderGuide = (
    positions: GetPortfolioPositionsResponseData,
    isComplete = false
  ) => textOf(renderGuideMarkup(positions, isComplete));

  const doneCountOf = (text: string) => text.split('(concluído)').length - 1;

  it('starts from the portfolio, its name and currency, and can be hidden', () => {
    const text = renderGuide({
      items: [],
      total: 0,
      page: 1,
      pageSize: 1,
      totalPages: 0
    });

    assert.match(text, /Aposentadoria/);
    assert.match(text, /BRL/);
    assert.match(text, /Gerenciar carteiras/);
    assert.match(text, /Ocultar guia/);
    assert.equal(doneCountOf(text), 0);
  });

  it('marks the first steps done and offers a transaction once an asset is held', () => {
    const text = renderGuide(HELD_ASSET);

    assert.doesNotMatch(text, /Gerenciar carteiras/);
    assert.match(text, /Registrar transação de PETR4/);
    assert.equal(doneCountOf(text), 2);
  });

  it('offers no step and claims no progress while the first asset loads', () => {
    const markup = renderGuideMarkup();
    const text = textOf(markup);

    assert.match(markup, /<ol aria-busy="true"/);
    assert.match(text, /Adicione um ativo/);
    assert.doesNotMatch(
      text,
      /Gerenciar carteiras|Adicionar ativo|Registrar transação/
    );
    assert.equal(doneCountOf(text), 0);
  });

  it('announces the recorded transaction with every step done but following the portfolio', () => {
    const text = renderGuide(HELD_ASSET, true);

    assert.match(
      text,
      /Transação registrada\. A visão geral agora mostra o valor, o desempenho e a alocação da carteira\./
    );
    assert.doesNotMatch(text, /Registrar transação de PETR4/);
    assert.equal(doneCountOf(text), 3);
  });

  it('announces nothing while a step remains', () => {
    assert.match(
      renderGuideMarkup(HELD_ASSET),
      /<p role="status" class="sr-only"><\/p>/
    );
  });
});

describe('getting started stage', () => {
  it('opens for a portfolio without transactions and completes with its first one', () => {
    assert.equal(nextGettingStartedStage('hidden', 0), 'open');
    assert.equal(nextGettingStartedStage('open', 1), 'complete');
  });

  it('stays out of the way of a portfolio that already has transactions', () => {
    assert.equal(nextGettingStartedStage('hidden', 3), 'hidden');
    assert.equal(nextGettingStartedStage('revealed', 2), 'revealed');
  });

  it('keeps its stage while the count loads and reopens when it returns to zero', () => {
    assert.equal(nextGettingStartedStage('open', undefined), 'open');
    assert.equal(nextGettingStartedStage('complete', undefined), 'complete');
    assert.equal(nextGettingStartedStage('leaving', 1), 'leaving');
    assert.equal(nextGettingStartedStage('revealed', 0), 'open');
  });
});
