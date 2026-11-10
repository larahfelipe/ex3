import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ImportLimits } from '@/config/Constants';

import {
  planImport,
  type AssetResolution,
  type ExistingTransaction,
  type ImportPlanInput
} from './ImportPlan';
import type { ReadRow } from './ImportReading';
import type { ImportedEntry, ImportReviewReason } from './ImportRecord';

let rowNumber = 1;

const entry = (
  values: Pick<ImportedEntry, 'symbol' | 'type' | 'tradeDate' | 'quantity'> &
    Partial<ImportedEntry>
): ImportedEntry => ({
  unitPrice: '10',
  fees: '0',
  taxes: '0',
  currency: 'BRL',
  broker: 'XP INVESTIMENTOS',
  notes: null,
  ...values
});

const readRow = (
  values: Parameters<typeof entry>[0],
  review: ImportReviewReason | null = null,
  keyNamespace = 'b3'
): ReadRow => {
  rowNumber += 1;

  return {
    format: 'b3-trades',
    keyNamespace,
    source: {
      sheet: 'Negociação',
      rowNumber,
      cells: { row: String(rowNumber) }
    },
    mapped: { outcome: 'entry', entry: entry(values), warnings: [], review }
  };
};

const ignoredRow: ReadRow = {
  format: 'b3-movements',
  keyNamespace: 'b3',
  source: { sheet: 'Movimentação', rowNumber: 2, cells: {} },
  mapped: { outcome: 'ignored', reason: 'settlement' }
};

const rejectedRow: ReadRow = {
  format: 'b3-trades',
  keyNamespace: 'b3',
  source: { sheet: 'Negociação', rowNumber: 3, cells: {} },
  mapped: {
    outcome: 'rejected',
    problems: [{ code: 'unsupported-market', field: 'market' }]
  }
};

const held = (
  instrumentId: string,
  currency: string | null = 'BRL',
  status: 'held' | 'tracked' = 'held'
): AssetResolution => ({
  status,
  instrumentId,
  name: instrumentId,
  currency
});

const listed: AssetResolution = {
  status: 'listed',
  name: 'Listed',
  currency: 'BRL'
};

const transaction = (
  values: Pick<
    ExistingTransaction,
    'id' | 'instrumentId' | 'type' | 'quantity'
  > &
    Partial<ExistingTransaction>
): ExistingTransaction => ({
  currency: 'BRL',
  executedAt: new Date('2026-01-05T03:00:00.000Z'),
  unitPrice: '10',
  fees: '0',
  taxes: '0',
  sequence: 1n,
  importKey: null,
  ...values
});

const plan = (
  input: Partial<ImportPlanInput> & Pick<ImportPlanInput, 'rows'>
) =>
  planImport({
    assets: new Map(),
    transactions: [],
    existingKeys: new Set(),
    selection: null,
    ...input
  });

const keysOf = (rows: ReadonlyArray<ReadRow>) =>
  plan({ rows }).rows.map(({ key }) => key);

describe('import keys', () => {
  const buy = {
    symbol: 'PETR4',
    type: 'BUY',
    tradeDate: '2026-01-05',
    quantity: '100'
  } as const;
  const sale = { ...buy, type: 'SELL', tradeDate: '2026-01-06' } as const;

  it('digests what a row records, wherever it sits in the file', () => {
    const [buyKey, saleKey] = keysOf([readRow(buy), readRow(sale)]);

    assert.match(buyKey ?? '', /^[0-9a-f]{64}$/);
    assert.deepEqual(keysOf([readRow(sale), readRow(buy)]), [saleKey, buyKey]);
    assert.deepEqual(
      keysOf([readRow({ ...buy, quantity: '100.000', unitPrice: '10.0' })]),
      [buyKey]
    );
  });

  it('tells equal rows apart by their count among the rows like them', () => {
    const [first, second] = keysOf([readRow(buy), readRow(buy)]);

    assert.notEqual(first, second);
    assert.deepEqual(keysOf([readRow(buy)]), [first]);
  });

  it('differs for another value, broker or layout', () => {
    const [key] = keysOf([readRow(buy)]);

    for (const row of [
      readRow({ ...buy, unitPrice: '10.01' }),
      readRow({ ...buy, broker: 'NU INVEST' }),
      readRow(buy, null, 'ex3-template')
    ])
      assert.notEqual(keysOf([row])[0], key);
  });

  it('gives rows that record nothing no key', () => {
    assert.deepEqual(keysOf([ignoredRow, rejectedRow]), [null, null]);
  });
});

describe('row statuses', () => {
  const buy = {
    symbol: 'PETR4',
    type: 'BUY',
    tradeDate: '2026-01-05',
    quantity: '100'
  } as const;

  it('marks a row already imported as a duplicate, never selected', () => {
    const [key] = keysOf([readRow(buy)]);
    const { rows } = plan({
      rows: [readRow(buy)],
      assets: new Map([['PETR4', listed]]),
      existingKeys: new Set([key ?? ''])
    });

    assert.equal(rows[0].status, 'duplicate');
    assert.equal(rows[0].isSelected, false);
  });

  it('tells why a symbol resolves to no instrument', () => {
    const { rows } = plan({
      rows: [
        readRow(buy),
        readRow({ ...buy, symbol: 'VALE3' }),
        readRow({ ...buy, symbol: 'AAPL', currency: 'USD' }),
        readRow({ ...buy, symbol: 'WEGE3', currency: null })
      ],
      assets: new Map<string, AssetResolution>([
        ['VALE3', { status: 'unresolved', reason: 'market-data-unavailable' }],
        ['AAPL', held('aapl', 'BRL')],
        ['WEGE3', held('wege3', null, 'tracked')]
      ])
    });

    assert.deepEqual(
      rows.map(({ status, reason }) => `${status}:${reason}`),
      [
        'unresolved:not-found',
        'unresolved:market-data-unavailable',
        'unresolved:currency-mismatch',
        'unresolved:currency-unknown'
      ]
    );
  });

  it('records a row without a currency in that of the instrument or of its ledger', () => {
    const { rows } = plan({
      rows: [readRow({ ...buy, currency: null })],
      assets: new Map([['PETR4', held('petr4', null)]]),
      transactions: [
        transaction({
          id: 't1',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '1',
          currency: 'BRL',
          executedAt: new Date('2025-06-02T03:00:00.000Z')
        })
      ]
    });

    assert.equal(rows[0].status, 'ready');
    assert.equal(rows[0].entry?.currency, 'BRL');
  });

  it('matches a possible duplicate to one transaction of that day, type and quantity', () => {
    const { rows } = plan({
      rows: [readRow(buy), readRow(buy), readRow({ ...buy, quantity: '50' })],
      assets: new Map([['PETR4', held('petr4')]]),
      transactions: [
        transaction({
          id: 'recorded',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '100.0'
        })
      ]
    });

    assert.deepEqual(
      rows.map(({ status, matchedTransactionId }) => [
        status,
        matchedTransactionId
      ]),
      [
        ['possible-duplicate', 'recorded'],
        ['ready', null],
        ['ready', null]
      ]
    );
  });

  it('matches a transaction recorded at UTC midnight of the day too', () => {
    const { rows } = plan({
      rows: [readRow(buy)],
      assets: new Map([['PETR4', held('petr4')]]),
      transactions: [
        transaction({
          id: 'utc',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '100',
          executedAt: new Date('2026-01-05T00:00:00.000Z')
        })
      ]
    });

    assert.equal(rows[0].status, 'possible-duplicate');
  });

  it('matches a B3 trade to one recorded at its price on the day it was made or settled', () => {
    const recordedOn = (day: string) =>
      transaction({
        id: 'recorded',
        instrumentId: 'petr4',
        type: 'BUY',
        quantity: '100',
        executedAt: new Date(`${day}T03:00:00.000Z`)
      });
    const statusOf = (row: ReadRow, recordedDay = '2026-01-05') =>
      plan({
        rows: [row],
        assets: new Map([['PETR4', held('petr4')]]),
        transactions: [recordedOn(recordedDay)]
      }).rows[0].status;
    const settlementOf = (values: Partial<ImportedEntry>): ReadRow => ({
      ...readRow({ ...buy, ...values }),
      format: 'b3-movements'
    });

    assert.equal(
      statusOf(settlementOf({ tradeDate: '2026-01-07' })),
      'possible-duplicate'
    );
    assert.equal(
      statusOf(settlementOf({ tradeDate: '2026-01-12' })),
      'possible-duplicate'
    );
    assert.equal(statusOf(settlementOf({ tradeDate: '2026-01-13' })), 'ready');
    assert.equal(statusOf(settlementOf({ tradeDate: '2026-01-04' })), 'ready');
    assert.equal(
      statusOf(settlementOf({ tradeDate: '2026-01-07', unitPrice: '10.5' })),
      'ready'
    );
    assert.equal(statusOf(readRow(buy), '2026-01-07'), 'possible-duplicate');
    assert.equal(
      statusOf(readRow({ ...buy, tradeDate: '2026-01-08' }), '2026-01-07'),
      'ready'
    );
    assert.equal(
      statusOf(
        {
          ...readRow(buy),
          format: 'ex3-template',
          keyNamespace: 'ex3-template'
        },
        '2026-01-07'
      ),
      'ready'
    );
  });

  it('does not match the transaction a row of the file was imported as', () => {
    const [firstKey] = keysOf([readRow(buy), readRow(buy)]);
    const { rows } = plan({
      rows: [readRow(buy), readRow(buy)],
      assets: new Map([['PETR4', held('petr4')]]),
      transactions: [
        transaction({
          id: 'imported',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '100',
          importKey: firstKey
        })
      ],
      existingKeys: new Set([firstKey ?? ''])
    });

    assert.deepEqual(
      rows.map(({ status }) => status),
      ['duplicate', 'ready']
    );
  });

  it('matches each settlement of the longest file one import reads to its own trade', () => {
    const count = ImportLimits.DATA_ROWS;
    const dayOf = (index: number, offset = 0) =>
      new Date(Date.UTC(1940, 0, 1 + index * 6 + offset))
        .toISOString()
        .slice(0, 10);
    const transactions = Array.from({ length: count }, (_, index) =>
      transaction({
        id: `t${index}`,
        instrumentId: 'petr4',
        type: 'BUY',
        quantity: '100',
        unitPrice: String(10 + index),
        executedAt: new Date(`${dayOf(index)}T12:00:00.000Z`),
        sequence: BigInt(index + 1)
      })
    );
    const rows = Array.from({ length: count }, (_, position): ReadRow => {
      const index = count - 1 - position;

      return {
        ...readRow({
          ...buy,
          tradeDate: dayOf(index, 2),
          unitPrice: String(10 + index)
        }),
        format: 'b3-movements'
      };
    });
    const planned = plan({
      rows,
      assets: new Map([['PETR4', held('petr4')]]),
      transactions
    });

    assert.equal(planned.counts['possible-duplicate'], count);
    assert.deepEqual(
      planned.rows.map(({ matchedTransactionId }) => matchedTransactionId),
      transactions.map(({ id }) => id).toReversed()
    );
  });

  it('keeps rows B3 says too little about for review', () => {
    const { rows } = plan({
      rows: [readRow({ ...buy, type: 'BONUS', unitPrice: '0' }, 'split')],
      assets: new Map([['PETR4', listed]])
    });

    assert.equal(rows[0].status, 'review');
    assert.equal(rows[0].reason, 'split');
    assert.equal(rows[0].isSelected, false);
  });
});

describe('selection', () => {
  const buy = {
    symbol: 'PETR4',
    type: 'BUY',
    tradeDate: '2026-01-05',
    quantity: '100'
  } as const;
  const rows = [
    readRow(buy),
    readRow({ ...buy, type: 'BONUS', quantity: '10', unitPrice: '0' }, 'split'),
    readRow({ ...buy, quantity: '7' }),
    ignoredRow,
    rejectedRow
  ];
  const input = {
    rows,
    assets: new Map([['PETR4', held('petr4')]]),
    transactions: [
      transaction({
        id: 'recorded',
        instrumentId: 'petr4',
        type: 'BUY',
        quantity: '7'
      })
    ]
  };

  it('selects the ready rows by default', () => {
    assert.deepEqual(
      plan(input).rows.map(({ status, isSelected }) => [status, isSelected]),
      [
        ['ready', true],
        ['review', false],
        ['possible-duplicate', false],
        ['ignored', false],
        ['rejected', false]
      ]
    );
  });

  it('selects the rows named instead, of those that may be imported', () => {
    const keys = plan(input).rows.map(({ key }) => key);
    const { rows: planned, recorded } = plan({
      ...input,
      selection: new Set([keys[1] ?? '', keys[2] ?? ''])
    });

    assert.deepEqual(
      planned.map(({ isSelected }) => isSelected),
      [false, true, true, false, false]
    );
    assert.deepEqual(
      recorded.map(({ key }) => key),
      [keys[1], keys[2]]
    );
  });
});

describe('the effect on positions', () => {
  const day = (tradeDate: string) => ({ symbol: 'PETR4', tradeDate }) as const;

  it('records the acquisitions of a day before its sales, and income last', () => {
    const { rows, recorded, assets } = plan({
      rows: [
        readRow({
          ...day('2026-01-06'),
          type: 'DIVIDEND',
          quantity: '100',
          unitPrice: '1',
          taxes: '15'
        }),
        readRow({
          ...day('2026-01-05'),
          type: 'SELL',
          quantity: '40',
          unitPrice: '12'
        }),
        readRow({
          ...day('2026-01-05'),
          type: 'BUY',
          quantity: '100',
          unitPrice: '10'
        }),
        readRow({
          ...day('2026-01-05'),
          type: 'BONUS',
          quantity: '10',
          unitPrice: '0'
        })
      ],
      assets: new Map([['PETR4', listed]])
    });

    assert.deepEqual(
      recorded.map(({ entry }) => entry.type),
      ['BUY', 'BONUS', 'SELL', 'DIVIDEND']
    );
    assert.deepEqual(
      recorded.map(({ executedAt }) => executedAt.toISOString()),
      [
        '2026-01-05T03:00:00.000Z',
        '2026-01-05T03:00:00.000Z',
        '2026-01-05T03:00:00.000Z',
        '2026-01-06T03:00:00.000Z'
      ]
    );
    assert.ok(rows.every(({ status }) => status === 'ready'));
    assert.deepEqual(assets, [
      {
        symbol: 'PETR4',
        resolution: 'listed',
        name: 'Listed',
        currency: 'BRL',
        rowCount: 4,
        selectedCount: 4,
        before: null,
        after: {
          quantity: '70',
          averageCost: '9.090909090909090909',
          investedValue: '636.36363636363636363',
          realizedProfitLoss: '116.36363636363636364'
        },
        netIncome: '85',
        refusal: null
      }
    ]);
  });

  it('adds to the position the portfolio holds', () => {
    const { assets } = plan({
      rows: [
        readRow({
          ...day('2026-02-02'),
          type: 'SELL',
          quantity: '10',
          unitPrice: '15'
        })
      ],
      assets: new Map([['PETR4', held('petr4')]]),
      transactions: [
        transaction({
          id: 't1',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '20',
          unitPrice: '10',
          fees: '2'
        })
      ]
    });

    assert.deepEqual(assets[0].before, {
      quantity: '20',
      averageCost: '10.1',
      investedValue: '202',
      realizedProfitLoss: '0'
    });
    assert.deepEqual(assets[0].after, {
      quantity: '10',
      averageCost: '10.1',
      investedValue: '101',
      realizedProfitLoss: '49'
    });
  });

  it('refuses every selected row of an asset whose ledger the rows would break', () => {
    const { rows, assets, recorded, counts } = plan({
      rows: [
        readRow({ ...day('2026-01-05'), type: 'BUY', quantity: '10' }),
        readRow({ ...day('2026-01-07'), type: 'SELL', quantity: '30' }),
        readRow({
          symbol: 'VALE3',
          tradeDate: '2026-01-05',
          type: 'BUY',
          quantity: '5'
        })
      ],
      assets: new Map([
        ['PETR4', held('petr4')],
        ['VALE3', listed]
      ]),
      transactions: [
        transaction({
          id: 't1',
          instrumentId: 'petr4',
          type: 'BUY',
          quantity: '15',
          executedAt: new Date('2025-12-01T03:00:00.000Z')
        })
      ]
    });

    assert.deepEqual(
      rows.map(({ status, reason, isSelected }) => [
        status,
        reason,
        isSelected
      ]),
      [
        ['refused', 'oversold', false],
        ['refused', 'oversold', false],
        ['ready', null, true]
      ]
    );
    assert.deepEqual(assets[0].refusal, {
      reason: 'oversold',
      tradeDate: '2026-01-07',
      row: { sheet: 'Negociação', rowNumber: rows[1].source.rowNumber }
    });
    assert.equal(assets[0].selectedCount, 0);
    assert.deepEqual(assets[0].after, assets[0].before);
    assert.deepEqual(
      recorded.map(({ entry }) => entry.symbol),
      ['VALE3']
    );
    assert.equal(counts.refused, 2);
    assert.equal(counts.ready, 1);
  });

  it('records the rows once the person leaves out the one that breaks the ledger', () => {
    const rows = [
      readRow({ ...day('2026-01-05'), type: 'BUY', quantity: '10' }),
      readRow({ ...day('2026-01-07'), type: 'SELL', quantity: '30' })
    ];
    const assets = new Map([['PETR4', listed]]);
    const [buyKey] = plan({ rows, assets }).rows.map(({ key }) => key);
    const replanned = plan({
      rows,
      assets,
      selection: new Set([buyKey ?? ''])
    });

    assert.deepEqual(
      replanned.rows.map(({ status }) => status),
      ['ready', 'ready']
    );
    assert.deepEqual(
      replanned.recorded.map(({ key }) => key),
      [buyKey]
    );
    assert.equal(replanned.assets[0].after?.quantity, '10');
  });

  it('counts every status', () => {
    const { counts } = plan({
      rows: [
        ignoredRow,
        rejectedRow,
        readRow({ ...day('2026-01-05'), type: 'BUY', quantity: '1' })
      ]
    });

    assert.deepEqual(counts, {
      ready: 0,
      review: 0,
      'possible-duplicate': 0,
      duplicate: 0,
      unresolved: 1,
      refused: 0,
      ignored: 1,
      rejected: 1
    });
  });
});
