import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  ImportFormatId,
  ImportPreview,
  ImportPreviewAsset,
  ImportPreviewRow,
  ImportProblemCode,
  ImportRowReason,
  ImportRowStatus,
  ImportWarning
} from '@/app/api/v1/transaction-imports';
import { LOCALES } from '@/i18n/config';
import { translatorOf } from '@/i18n/translator';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { ImportAssetsSection } from './import-assets-section';
import { rowNotesOf, rowReferenceOf } from './import-display';
import { ImportRowsSection } from './import-rows-section';
import { ImportSummary } from './import-summary';

const STATUSES: ReadonlyArray<ImportRowStatus> = [
  'ready',
  'review',
  'possible-duplicate',
  'duplicate',
  'unresolved',
  'refused',
  'ignored',
  'rejected'
];

const REASONS: ReadonlyArray<ImportRowReason> = [
  'settlement',
  'custody-transfer',
  'lending',
  'listed-elsewhere',
  'split',
  'transferred-income',
  'not-listed',
  'not-found',
  'market-data-unavailable',
  'too-many-new-assets',
  'currency-unknown',
  'currency-mismatch',
  'oversold',
  'out-of-range'
];

const WARNINGS: ReadonlyArray<ImportWarning> = [
  'value-mismatch',
  'withholding-derived',
  'unit-price-derived',
  'bonus-cost-unknown',
  'split-as-bonus',
  'transferred-income',
  'broker-truncated',
  'notes-truncated'
];

const PROBLEMS: ReadonlyArray<ImportProblemCode> = [
  'missing-value',
  'invalid-date',
  'ambiguous-date',
  'future-date',
  'invalid-number',
  'not-positive',
  'invalid-symbol',
  'invalid-currency',
  'unsupported-type',
  'unsupported-market',
  'unsupported-event',
  'unsupported-product',
  'income-debit'
];

const rowWith = (
  rowNumber: number,
  status: ImportRowStatus,
  overrides: Partial<ImportPreviewRow> = {}
): ImportPreviewRow => ({
  key: `key-${rowNumber}`,
  format: 'b3-trades',
  entry: {
    symbol: 'PETR4',
    tradeDate: '2026-03-02',
    type: 'BUY',
    quantity: '100',
    unitPrice: '38.45',
    fees: '0',
    taxes: '0',
    currency: 'BRL',
    broker: null,
    notes: null
  },
  status,
  isSelected: status === 'ready',
  warnings: [],
  problems: [],
  reason: null,
  matchedTransactionId: null,
  sheet: 'Negociação',
  rowNumber,
  cells: { 'Código de Negociação': 'PETR4', Quantidade: '100' },
  ...overrides
});

const rowsSection = (
  rows: Array<ImportPreviewRow>,
  selection: ReadonlySet<string>,
  locale: (typeof LOCALES)[number] = 'pt-BR'
) =>
  renderWithIntl(
    <ImportRowsSection
      rows={rows}
      selection={selection}
      isLocked={false}
      onSelectionChange={() => undefined}
    />,
    locale
  );

describe('an import row’s notes', () => {
  it('name every reason, warning and problem the API sends, in each locale', () => {
    for (const locale of LOCALES) {
      const t = translatorOf(locale, 'imports.rows');
      const notes = rowNotesOf(
        {
          reason: null,
          matchedTransactionId: null,
          warnings: [...WARNINGS],
          problems: PROBLEMS.map((code) => ({ code, field: 'quantity' }))
        },
        t
      );

      assert.equal(new Set(notes).size, WARNINGS.length + PROBLEMS.length);
      assert.ok(notes.every((note) => note.trim() !== ''));

      for (const reason of REASONS)
        assert.notEqual(
          rowNotesOf(
            {
              reason,
              matchedTransactionId: null,
              warnings: [],
              problems: []
            },
            t
          )[0],
          undefined
        );
    }
  });

  it('say a warning once when it is also the reason', () => {
    const t = translatorOf('en-US', 'imports.rows');

    assert.deepEqual(
      rowNotesOf(
        {
          reason: 'transferred-income',
          matchedTransactionId: 'tx-1',
          warnings: ['transferred-income', 'withholding-derived'],
          problems: [{ code: 'missing-value', field: null }]
        },
        t
      ),
      [
        t('reasons.transferred-income'),
        t('matched'),
        t('warnings.withholding-derived'),
        t('problems.missing-value', { field: t('fields.unknown') })
      ]
    );
  });

  it('point at a row by its sheet only when the file has sheets', () => {
    const t = translatorOf('pt-BR', 'imports.assets');

    assert.notEqual(
      rowReferenceOf({ sheet: 'Negociação', rowNumber: 7 }, t),
      rowReferenceOf({ sheet: '', rowNumber: 7 }, t)
    );
    assert.match(
      rowReferenceOf({ sheet: 'Negociação', rowNumber: 7 }, t),
      /Negociação/
    );
  });
});

describe('the rows of a preview', () => {
  it('render every status in each locale', () => {
    for (const locale of LOCALES)
      assert.doesNotThrow(() =>
        rowsSection(
          STATUSES.map((status, index) => rowWith(index + 2, status)),
          new Set(),
          locale
        )
      );
  });

  it('offer a checkbox only for a row the person may include, checked as selected', () => {
    const markup = rowsSection(
      [
        rowWith(2, 'ready'),
        rowWith(3, 'review'),
        rowWith(4, 'duplicate'),
        rowWith(5, 'rejected', { key: null, entry: null })
      ],
      new Set(['key-2'])
    );
    const checkboxes = [
      ...markup.matchAll(/<input type="checkbox"[^>]*>/g)
    ].map(([input]) => input);

    assert.equal(checkboxes.length, 3);
    assert.match(checkboxes[0] ?? '', /aria-label="[^"]+"/);
    assert.ok(checkboxes[1]?.includes('checked'));
    assert.ok(!checkboxes[2]?.includes('checked'));
  });

  it('keep the original cells collapsed until asked for', () => {
    const markup = rowsSection([rowWith(2, 'ready')], new Set(['key-2']));

    assert.match(markup, /aria-expanded="false"/);
    assert.ok(!textOf(markup).includes('Código de Negociação'));
  });

  it('show a row that became no transaction without inventing its values', () => {
    const text = textOf(
      rowsSection(
        [
          rowWith(9, 'rejected', {
            key: null,
            entry: null,
            problems: [{ code: 'invalid-date', field: 'date' }]
          })
        ],
        new Set()
      )
    );

    assert.ok(!text.includes('PETR4'));
    assert.ok(
      text.includes(
        translatorOf('pt-BR', 'imports.rows')('problems.invalid-date', {
          field: translatorOf('pt-BR', 'imports.rows')('fields.date')
        })
      )
    );
  });
});

describe('the assets of a preview', () => {
  const asset: ImportPreviewAsset = {
    symbol: 'PETR4',
    resolution: 'held',
    name: 'Petrobras PN',
    currency: 'BRL',
    rowCount: 3,
    selectedCount: 2,
    before: {
      quantity: '100',
      averageCost: '30',
      investedValue: '3000',
      realizedProfitLoss: '0'
    },
    after: {
      quantity: '150',
      averageCost: '32',
      investedValue: '4800',
      realizedProfitLoss: '0'
    },
    netIncome: '12.5',
    refusal: null
  };

  it('show a figure the import changes beside what it was, and one it keeps once', () => {
    const text = textOf(
      renderWithIntl(<ImportAssetsSection assets={[asset]} />)
    );

    assert.ok(text.includes('150antes 100'));
    assert.ok(
      text.includes(`${nbsp('R$ 4.800,00')}antes ${nbsp('R$ 3.000,00')}`)
    );
    assert.ok(!text.includes(`antes ${nbsp('R$ 0,00')}`));
  });

  it('say why an asset’s rows were cleared, naming the sale that oversells', () => {
    const text = textOf(
      renderWithIntl(
        <ImportAssetsSection
          assets={[
            {
              ...asset,
              selectedCount: 0,
              refusal: {
                reason: 'oversold',
                tradeDate: '2026-03-04',
                row: { sheet: 'Negociação', rowNumber: 12 }
              }
            }
          ]}
        />
      )
    );

    assert.match(text, /04\/03\/2026/);
    assert.match(text, /12/);
  });
});

describe('the summary of a preview', () => {
  const summaryOf = (formats: Array<ImportFormatId>) => {
    const preview: ImportPreview = {
      file: { name: 'movimentacao.xlsx', formats },
      counts: {
        ready: 0,
        review: 0,
        'possible-duplicate': 0,
        duplicate: 0,
        unresolved: 0,
        refused: 0,
        ignored: 0,
        rejected: 0
      },
      selectedKeys: [],
      assets: [],
      rows: []
    };

    return textOf(
      renderWithIntl(<ImportSummary preview={preview} selectedCount={0} />)
    );
  };

  it('tell that a movement statement dates its trades on the day they settled', () => {
    const note = translatorOf('pt-BR', 'imports.summary')('settlementDates');

    assert.ok(summaryOf(['b3-movements']).includes(note));
    assert.ok(summaryOf(['b3-trades', 'b3-movements']).includes(note));
    assert.ok(!summaryOf(['b3-trades']).includes(note));
    assert.ok(!summaryOf(['ex3-template']).includes(note));
  });
});
