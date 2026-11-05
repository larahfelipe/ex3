import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ImportLimits } from '@/config/Constants';

import {
  readImportRows,
  type ImportSheet,
  type ImportWorkbook,
  type ReadRow
} from './ImportReading';
import type { ImportedEntry, MappedRow } from './ImportRecord';
import type { ImportCell } from './ImportValues';

const TODAY = '2026-11-04';

type Value = string | number | null;

const cellOf = (value: Value): ImportCell | null =>
  value === null
    ? null
    : typeof value === 'number'
      ? { kind: 'number', value: String(value) }
      : { kind: 'text', value };

const sheetOf = (
  name: string,
  rows: ReadonlyArray<ReadonlyArray<Value>>
): ImportSheet => ({
  name,
  rows: rows.map((cells, index) => ({
    number: index + 1,
    cells: cells.map(cellOf)
  }))
});

const workbookOf = (
  sheets: ReadonlyArray<ImportSheet>,
  decimalSeparator: ',' | '.' = ','
): ImportWorkbook => ({ sheets, date1904: false, decimalSeparator });

const read = (workbook: ImportWorkbook, maxRows = 100) =>
  readImportRows(workbook, { today: TODAY, maxRows });

const rowsOf = (workbook: ImportWorkbook) => {
  const reading = read(workbook);

  assert.equal(reading.outcome, 'read');

  return reading.rows;
};

const entryOf = (row: ReadRow | undefined) => {
  assert.equal(row?.mapped.outcome, 'entry');

  return row.mapped;
};

const problemsOf = (row: ReadRow | undefined) => {
  assert.equal(row?.mapped.outcome, 'rejected');

  return row.mapped.problems.map(({ code, field }) => `${code}:${field}`);
};

const ignoredReasonOf = ({ mapped }: { mapped: MappedRow }) =>
  mapped.outcome === 'ignored' ? mapped.reason : null;

const entry = (
  values: Pick<ImportedEntry, 'symbol' | 'type' | 'tradeDate' | 'quantity'> &
    Partial<ImportedEntry>
): ImportedEntry => ({
  unitPrice: '0',
  fees: '0',
  taxes: '0',
  currency: 'BRL',
  broker: 'XP INVESTIMENTOS',
  notes: null,
  ...values
});

const TRADES_HEADER = [
  'Data do Negócio',
  'Tipo de Movimentação',
  'Mercado',
  'Prazo/Vencimento',
  'Instituição',
  'Código de Negociação',
  'Quantidade',
  'Preço',
  'Valor'
];

const INCOME_HEADER = [
  'Produto',
  'Pagamento',
  'Tipo de Evento',
  'Instituição',
  'Quantidade',
  'Preço unitário',
  'Valor líquido'
];

const MOVEMENTS_HEADER = [
  'Entrada/Saída',
  'Data',
  'Movimentação',
  'Produto',
  'Instituição',
  'Quantidade',
  'Preço unitário',
  'Valor da Operação'
];

describe('the B3 trading statement', () => {
  const rows = rowsOf(
    workbookOf([
      sheetOf('Negociação', [
        TRADES_HEADER,
        [
          '05/01/2026',
          'Compra',
          'Mercado à Vista',
          '-',
          'XP INVESTIMENTOS',
          'PETR4',
          100,
          30.5,
          3050
        ],
        [
          '06/01/2026',
          'Venda',
          'Mercado Fracionário',
          '-',
          'XP INVESTIMENTOS',
          'petr4f',
          5,
          '31,00',
          '155,00'
        ],
        [
          '07/01/2026',
          'Compra',
          'Opção de Compra',
          '-',
          'XP INVESTIMENTOS',
          'PETRA30',
          100,
          1,
          100
        ],
        [
          '08/01/2026',
          'Compra',
          'Mercado à Vista',
          '-',
          'XP INVESTIMENTOS',
          'VALE3',
          10,
          '62,10',
          '600,00'
        ],
        [
          '05/12/2026',
          'Compra',
          'Mercado à Vista',
          '-',
          'XP INVESTIMENTOS',
          'VALE3',
          0,
          '62,10',
          null
        ],
        [
          '09/01/2026',
          'Aluguel',
          null,
          '-',
          'XP INVESTIMENTOS',
          'VALE3',
          10,
          -1,
          null
        ],
        [null, null, null, null, null, null, null, null, null],
        ['Total', null, null, null, null, null, null, null, 3905]
      ])
    ])
  );

  it('reads a purchase and a sale of the cash market, in whole and odd lots', () => {
    assert.equal(rows.length, 6);
    assert.ok(rows.every(({ format }) => format === 'b3-trades'));
    assert.deepEqual(entryOf(rows[0]), {
      outcome: 'entry',
      entry: entry({
        symbol: 'PETR4',
        type: 'BUY',
        tradeDate: '2026-01-05',
        quantity: '100',
        unitPrice: '30.5'
      }),
      warnings: [],
      review: null
    });
    assert.deepEqual(
      entryOf(rows[1]).entry,
      entry({
        symbol: 'PETR4',
        type: 'SELL',
        tradeDate: '2026-01-06',
        quantity: '5',
        unitPrice: '31'
      })
    );
  });

  it('keeps every row of the file by the header of its column', () => {
    assert.deepEqual(rows[1].source, {
      sheet: 'Negociação',
      rowNumber: 3,
      cells: {
        'Data do Negócio': '06/01/2026',
        'Tipo de Movimentação': 'Venda',
        Mercado: 'Mercado Fracionário',
        Instituição: 'XP INVESTIMENTOS',
        'Código de Negociação': 'petr4f',
        Quantidade: '5',
        Preço: '31,00',
        Valor: '155,00'
      }
    });
  });

  it('rejects a trade of another market and reports every problem of a row', () => {
    assert.deepEqual(problemsOf(rows[2]), [
      'unsupported-market:market',
      'invalid-symbol:symbol'
    ]);
    assert.deepEqual(problemsOf(rows[4]), [
      'future-date:date',
      'not-positive:quantity'
    ]);
    assert.deepEqual(problemsOf(rows[5]), [
      'unsupported-type:type',
      'missing-value:market',
      'invalid-number:unitPrice'
    ]);
  });

  it('warns when the total differs from quantity times price', () => {
    assert.deepEqual(entryOf(rows[3]).warnings, ['value-mismatch']);
  });
});

describe('the B3 income statement', () => {
  const rows = rowsOf(
    workbookOf([
      sheetOf('Proventos Recebidos', [
        INCOME_HEADER,
        [
          'ITSA4 - ITAUSA S.A.',
          '01/04/2026',
          'Juros Sobre Capital Próprio',
          'XP INVESTIMENTOS',
          1000,
          0.02,
          17
        ],
        [
          'HGLG11 - CSHG LOGÍSTICA FDO INV IMOB',
          '15/04/2026',
          'Rendimento',
          'XP INVESTIMENTOS',
          10,
          1.1,
          11
        ],
        [
          'PETR4 - PETROBRAS',
          '20/05/2026',
          'Dividendo',
          'XP INVESTIMENTOS',
          100,
          '-',
          145.5
        ],
        [
          'Tesouro Selic 2029',
          '20/05/2026',
          'Juros',
          'XP INVESTIMENTOS',
          1,
          10,
          10
        ],
        [
          'BBAS3 - BANCO DO BRASIL',
          '20/05/2026',
          'Amortização',
          'XP INVESTIMENTOS',
          10,
          1,
          10
        ],
        ['Total', null, null, null, null, null, 183.5]
      ])
    ])
  );

  it('derives the withholding of interest on equity from its net amount', () => {
    assert.deepEqual(entryOf(rows[0]), {
      outcome: 'entry',
      entry: entry({
        symbol: 'ITSA4',
        type: 'JCP',
        tradeDate: '2026-04-01',
        quantity: '1000',
        unitPrice: '0.02',
        taxes: '3'
      }),
      warnings: ['withholding-derived'],
      review: null
    });
  });

  it('reads income with nothing withheld', () => {
    assert.deepEqual(entryOf(rows[1]), {
      outcome: 'entry',
      entry: entry({
        symbol: 'HGLG11',
        type: 'DIVIDEND',
        tradeDate: '2026-04-15',
        quantity: '10',
        unitPrice: '1.1'
      }),
      warnings: [],
      review: null
    });
  });

  it('derives the unit value from the net amount when the statement leaves it out', () => {
    const { entry: dividend, warnings } = entryOf(rows[2]);

    assert.equal(dividend.unitPrice, '1.455');
    assert.equal(dividend.taxes, '0');
    assert.deepEqual(warnings, ['unit-price-derived']);
  });

  it('rejects a product that is not a listed security and an event EX3 does not model', () => {
    assert.deepEqual(problemsOf(rows[3]), ['unsupported-product:symbol']);
    assert.deepEqual(problemsOf(rows[4]), ['unsupported-event:type']);
    assert.equal(rows.length, 5);
  });
});

describe('the B3 movement statement', () => {
  const movements = [
    MOVEMENTS_HEADER,
    [
      'Credito',
      '05/01/2026',
      'Transferência - Liquidação',
      'PETR4 - PETROBRAS',
      'XP INVESTIMENTOS',
      100,
      30.5,
      3050
    ],
    [
      'Credito',
      '05/01/2026',
      'Compra',
      'PETR4 - PETROBRAS',
      'XP INVESTIMENTOS',
      100,
      30.5,
      3050
    ],
    [
      'Debito',
      '03/03/2026',
      'Empréstimo',
      'PETR4 - PETROBRAS',
      'XP INVESTIMENTOS',
      100,
      '-',
      '-'
    ],
    [
      'Credito',
      '03/03/2026',
      'Transferência',
      'PETR4 - PETROBRAS',
      'NU INVEST',
      100,
      '-',
      '-'
    ],
    [
      'Credito',
      '10/02/2026',
      'Bonificação em Ativos',
      'ITSA4 - ITAUSA S.A.',
      'XP INVESTIMENTOS',
      10,
      '18,50',
      '-'
    ],
    [
      'Credito',
      '10/02/2026',
      'Bonificação em Ativos',
      'ITSA4 - ITAUSA S.A.',
      'XP INVESTIMENTOS',
      3,
      '-',
      '-'
    ],
    [
      'Credito',
      '11/02/2026',
      'Desdobro',
      'BBAS3 - BANCO DO BRASIL',
      'XP INVESTIMENTOS',
      100,
      '-',
      '-'
    ],
    [
      'Credito',
      '01/04/2026',
      'Juros Sobre Capital Próprio',
      'ITSA4 - ITAUSA S.A.',
      'XP INVESTIMENTOS',
      1000,
      0.02,
      17
    ],
    [
      'Credito',
      '01/04/2026',
      'Juros Sobre Capital Próprio - Transferido',
      'ITSA4 - ITAUSA S.A.',
      'XP INVESTIMENTOS',
      1000,
      0.02,
      17
    ],
    [
      'Credito',
      '05/05/2026',
      'Rendimento - Transferido',
      'HGLG11 - CSHG LOGÍSTICA',
      'XP INVESTIMENTOS',
      10,
      1.1,
      11
    ],
    [
      'Debito',
      '06/05/2026',
      'Dividendo',
      'PETR4 - PETROBRAS',
      'XP INVESTIMENTOS',
      100,
      1,
      100
    ],
    [
      'Credito',
      '07/05/2026',
      'Grupamento',
      'MGLU3 - MAGAZINE LUIZA',
      'XP INVESTIMENTOS',
      10,
      '-',
      '-'
    ],
    [
      'Credito',
      '07/05/2026',
      'Direito de Subscrição',
      'MGLU1 - MAGAZINE LUIZA',
      'XP INVESTIMENTOS',
      10,
      '-',
      '-'
    ]
  ];
  const rows = rowsOf(workbookOf([sheetOf('Movimentação', movements)]));

  it('reads a settlement transfer as the trade and ignores the plain purchase, custody transfers and lending', () => {
    assert.equal(entryOf(rows[0]).entry.type, 'BUY');
    assert.deepEqual(rows.slice(1, 4).map(ignoredReasonOf), [
      'settlement',
      'lending',
      'custody-transfer'
    ]);
  });

  it('reads the statement as the Investor Area exports it', () => {
    const sample = rowsOf(
      workbookOf([
        sheetOf('Movimentação', [
          MOVEMENTS_HEADER,
          [
            'Credito',
            '03/11/2026',
            'Transferência - Liquidação',
            'AXIA3 - AXIA ENERGIA S.A.',
            'BANCO BTG PACTUAL S/A.',
            10,
            48,
            480
          ],
          [
            'Debito',
            '03/11/2026',
            'Transferência - Liquidação',
            'EGIE3 - ENGIE BRASIL ENERGIA S.A.',
            'BANCO BTG PACTUAL S/A.',
            14,
            'R$ 27.14',
            'R$ 379.96'
          ],
          [
            'Credito',
            '03/11/2026',
            'Juros Sobre Capital Próprio',
            'ITUB4 - ITAU UNIBANCO HOLDING S.A',
            'BANCO BTG PACTUAL S/A.',
            31,
            'R$ 0.018',
            'R$ 0.47'
          ],
          [
            'Credito',
            '03/11/2026',
            'Transferência - Liquidação',
            'SBSP3 - CIA SANEAMENTO BASICO EST. SAO PAULO - SABESP',
            'BANCO BTG PACTUAL S/A.',
            10,
            25.14,
            251.4
          ]
        ])
      ])
    );
    const broker = 'BANCO BTG PACTUAL S/A.';

    assert.deepEqual(entryOf(sample[0]), {
      outcome: 'entry',
      entry: entry({
        symbol: 'AXIA3',
        type: 'BUY',
        tradeDate: '2026-11-03',
        quantity: '10',
        unitPrice: '48',
        broker
      }),
      warnings: [],
      review: null
    });
    assert.deepEqual(entryOf(sample[1]).entry, {
      ...entry({
        symbol: 'EGIE3',
        type: 'SELL',
        tradeDate: '2026-11-03',
        quantity: '14',
        unitPrice: '27.14',
        broker
      })
    });
    assert.deepEqual(entryOf(sample[2]).entry, {
      ...entry({
        symbol: 'ITUB4',
        type: 'JCP',
        tradeDate: '2026-11-03',
        quantity: '31',
        unitPrice: '0.018',
        taxes: '0.088',
        broker
      })
    });
    assert.equal(entryOf(sample[3]).entry.symbol, 'SBSP3');
  });

  it('reads a bonus at the cost attributed to it, and warns when there is none', () => {
    assert.deepEqual(entryOf(rows[4]), {
      outcome: 'entry',
      entry: entry({
        symbol: 'ITSA4',
        type: 'BONUS',
        tradeDate: '2026-02-10',
        quantity: '10',
        unitPrice: '18.5'
      }),
      warnings: [],
      review: null
    });
    assert.equal(entryOf(rows[5]).entry.unitPrice, '0');
    assert.deepEqual(entryOf(rows[5]).warnings, ['bonus-cost-unknown']);
  });

  it('reads a split as a bonus of the units it credits, waiting for review', () => {
    const split = entryOf(rows[6]);

    assert.equal(split.entry.type, 'BONUS');
    assert.equal(split.entry.unitPrice, '0');
    assert.deepEqual(split.warnings, ['split-as-bonus']);
    assert.equal(split.review, 'split');
  });

  it('keeps one of the credits B3 lists for one payment', () => {
    assert.equal(entryOf(rows[7]).entry.type, 'JCP');
    assert.equal(ignoredReasonOf(rows[8]), 'listed-elsewhere');

    const transferred = entryOf(rows[9]);

    assert.equal(transferred.entry.type, 'DIVIDEND');
    assert.deepEqual(transferred.warnings, ['transferred-income']);
    assert.equal(transferred.review, 'transferred-income');
  });

  it('rejects a debited payment and corporate actions EX3 does not model', () => {
    assert.deepEqual(problemsOf(rows[10]), ['income-debit:type']);
    assert.deepEqual(problemsOf(rows[11]), ['unsupported-event:type']);
    assert.deepEqual(problemsOf(rows[12]), ['unsupported-event:type']);
  });

  it('reads a variant header, an odd-lot product and the debit of a sale, and rejects a settlement it cannot price', () => {
    const rows = rowsOf(
      workbookOf([
        sheetOf('Movimentação', [
          ['Entrada / Saída', ...MOVEMENTS_HEADER.slice(1)],
          [
            'Débito',
            '05/01/2026',
            'Transferência - Liquidação',
            'PETR4F - PETROBRAS',
            'XP INVESTIMENTOS',
            5,
            '31,00',
            '155,00'
          ],
          [
            'Credito',
            '05/01/2026',
            'Transferência - Liquidação',
            'PETR4 - PETROBRAS',
            'XP INVESTIMENTOS',
            10,
            '-',
            '-'
          ],
          [
            'Bloqueio',
            '05/01/2026',
            'Transferência - Liquidação',
            'PETR4 - PETROBRAS',
            'XP INVESTIMENTOS',
            10,
            30,
            300
          ],
          [
            'Credito',
            '05/01/2026',
            'Transferência - Liquidação',
            'PETR4 - PETROBRAS',
            'XP INVESTIMENTOS',
            10,
            30,
            310
          ]
        ])
      ])
    );

    assert.deepEqual(
      entryOf(rows[0]).entry,
      entry({
        symbol: 'PETR4',
        type: 'SELL',
        tradeDate: '2026-01-05',
        quantity: '5',
        unitPrice: '31'
      })
    );
    assert.deepEqual(problemsOf(rows[1]), ['missing-value:unitPrice']);
    assert.deepEqual(problemsOf(rows[2]), ['unsupported-type:type']);
    assert.deepEqual(entryOf(rows[3]).warnings, ['value-mismatch']);
  });

  it('reads the numbers of a statement saved again with points for decimals', () => {
    const rows = rowsOf(
      workbookOf([
        sheetOf('movimentacao.csv', [
          MOVEMENTS_HEADER,
          [
            'Credito',
            '03/11/2026',
            'Transferência - Liquidação',
            'BBAS3 - BANCO DO BRASIL S/A',
            'BANCO BTG PACTUAL S/A.',
            '1,000',
            'R$ 16.74',
            'R$ 16,740.00'
          ],
          [
            'Credito',
            '03/11/2026',
            'Transferência - Liquidação',
            'BBDC3 - BANCO BRADESCO S/A',
            'BANCO BTG PACTUAL S/A.',
            '30',
            'R$ 1.234',
            'R$ 37.02'
          ]
        ])
      ])
    );

    assert.equal(entryOf(rows[0]).entry.quantity, '1000');
    assert.equal(entryOf(rows[0]).entry.unitPrice, '16.74');
    assert.deepEqual(entryOf(rows[0]).warnings, []);
    assert.equal(entryOf(rows[1]).entry.unitPrice, '1.234');
  });

  it('refuses the slashed dates of a statement whose dates show the month first', () => {
    const rows = rowsOf(
      workbookOf([
        sheetOf('Movimentação', [
          MOVEMENTS_HEADER,
          [
            'Credito',
            '11/03/2026',
            'Transferência - Liquidação',
            'PETR4 - PETROBRAS',
            'XP INVESTIMENTOS',
            10,
            30,
            300
          ],
          [
            'Credito',
            '11/13/2026',
            'Transferência - Liquidação',
            'PETR4 - PETROBRAS',
            'XP INVESTIMENTOS',
            10,
            30,
            300
          ]
        ])
      ])
    );

    assert.deepEqual(rows.map(problemsOf), [
      ['ambiguous-date:date'],
      ['ambiguous-date:date']
    ]);
  });

  it('gives way to the trading statement for a trade both list', () => {
    const settlement = (
      day: string,
      direction: 'Credito' | 'Debito',
      quantity: number,
      price: number
    ) => [
      direction,
      day,
      'Transferência - Liquidação',
      'PETR4 - PETROBRAS',
      'XP INVESTIMENTOS',
      quantity,
      price,
      quantity * price
    ];
    const reading = read(
      workbookOf([
        sheetOf('Negociação', [
          TRADES_HEADER,
          [
            '05/01/2026',
            'Compra',
            'Mercado à Vista',
            '-',
            'XP INVESTIMENTOS',
            'PETR4',
            100,
            30.5,
            3050
          ],
          [
            '06/01/2026',
            'Venda',
            'Mercado à Vista',
            '-',
            'XP INVESTIMENTOS',
            'PETR4',
            40,
            35,
            1400
          ]
        ]),
        sheetOf('Movimentação', [
          MOVEMENTS_HEADER,
          settlement('07/01/2026', 'Credito', 100, 30.5),
          settlement('08/01/2026', 'Debito', 40, 35),
          settlement('08/01/2026', 'Credito', 100, 30.5),
          settlement('20/01/2026', 'Debito', 40, 35)
        ])
      ])
    );

    assert.equal(reading.outcome, 'read');
    assert.deepEqual(
      reading.rows.map((row) =>
        row.mapped.outcome === 'entry'
          ? `${row.format}:${row.mapped.entry.type}`
          : ignoredReasonOf(row)
      ),
      [
        'b3-trades:BUY',
        'b3-trades:SELL',
        'listed-elsewhere',
        'listed-elsewhere',
        'b3-movements:BUY',
        'b3-movements:SELL'
      ]
    );
  });

  it('gives way to the trading statement for each trade of a file as long as one import reads', () => {
    const count = ImportLimits.DATA_ROWS / 2;
    const dayOf = (index: number, offset = 0) => {
      const [year, month, day] = new Date(
        Date.UTC(1980, 0, 1 + index * 6 + offset)
      )
        .toISOString()
        .slice(0, 10)
        .split('-');

      return `${day}/${month}/${year}`;
    };
    const indexes = Array.from({ length: count }, (_, index) => index);
    const reading = read(
      workbookOf([
        sheetOf('Negociação', [
          TRADES_HEADER,
          ...indexes.map((index) => [
            dayOf(index),
            'Compra',
            'Mercado à Vista',
            '-',
            'XP INVESTIMENTOS',
            'PETR4',
            100,
            30.5,
            3050
          ])
        ]),
        sheetOf('Movimentação', [
          MOVEMENTS_HEADER,
          ...indexes
            .toReversed()
            .map((index) => [
              'Credito',
              dayOf(index, 2),
              'Transferência - Liquidação',
              'PETR4 - PETROBRAS',
              'XP INVESTIMENTOS',
              100,
              30.5,
              3050
            ])
        ])
      ]),
      ImportLimits.DATA_ROWS
    );

    assert.equal(reading.outcome, 'read');
    assert.deepEqual(
      reading.rows.map((row) =>
        row.mapped.outcome === 'entry'
          ? `${row.format}:${row.mapped.entry.type}`
          : ignoredReasonOf(row)
      ),
      [
        ...indexes.map(() => 'b3-trades:BUY'),
        ...indexes.map(() => 'listed-elsewhere')
      ]
    );
  });

  it('gives way to the income statement for a payment both list', () => {
    const reading = read(
      workbookOf([
        sheetOf('Proventos Recebidos', [
          INCOME_HEADER,
          [
            'ITSA4 - ITAUSA S.A.',
            '01/04/2026',
            'Juros Sobre Capital Próprio',
            'XP INVESTIMENTOS',
            1000,
            0.02,
            17
          ]
        ]),
        sheetOf('Movimentação', movements)
      ])
    );

    assert.equal(reading.outcome, 'read');
    assert.deepEqual(reading.formats, ['b3-income', 'b3-movements']);
    assert.equal(reading.rows[0].format, 'b3-income');
    assert.equal(entryOf(reading.rows[0]).entry.type, 'JCP');
    assert.equal(ignoredReasonOf(reading.rows[8]), 'listed-elsewhere');
    assert.equal(ignoredReasonOf(reading.rows[9]), 'listed-elsewhere');
    assert.equal(entryOf(reading.rows[5]).entry.type, 'BONUS');
  });
});

describe('the EX3 template', () => {
  const header = [
    'Date',
    'Type',
    'Symbol',
    'Quantity',
    'Price',
    'Fees',
    'Taxes',
    'Currency',
    'Broker',
    'Notes'
  ];

  it('reads any broker history, in English or Portuguese', () => {
    const rows = rowsOf(
      workbookOf(
        [
          sheetOf('history.csv', [
            header,
            [
              '2026-01-05',
              'buy',
              'aapl',
              '10',
              '190.50',
              '1.00',
              '',
              'usd',
              'Avenue',
              ' first  lot '
            ],
            ['2026-01-05', 'Bonificação', 'ITSA4', '5', '', '', '', '', '', ''],
            ['2026-01-06', 'swap', 'TOO-LONG', '1', '1', '', '', 'US', '', '']
          ])
        ],
        '.'
      )
    );

    assert.ok(rows.every(({ format }) => format === 'ex3-template'));
    assert.deepEqual(entryOf(rows[0]).entry, {
      symbol: 'AAPL',
      type: 'BUY',
      tradeDate: '2026-01-05',
      quantity: '10',
      unitPrice: '190.5',
      fees: '1',
      taxes: '0',
      currency: 'USD',
      broker: 'Avenue',
      notes: 'first lot'
    });
    assert.deepEqual(entryOf(rows[1]).entry, {
      ...entry({
        symbol: 'ITSA4',
        type: 'BONUS',
        tradeDate: '2026-01-05',
        quantity: '5'
      }),
      currency: null,
      broker: null
    });
    assert.deepEqual(problemsOf(rows[2]), [
      'unsupported-type:type',
      'invalid-symbol:symbol',
      'invalid-currency:currency'
    ]);
  });

  it('reads a slashed date day first under a Portuguese header, and refuses it under the English one', () => {
    const rowOf = (dateHeader: string) =>
      rowsOf(
        workbookOf([
          sheetOf('s', [
            [dateHeader, 'Tipo', 'Ativo', 'Quantidade', 'Preço'],
            ['03/05/2026', 'Compra', 'WEGE3', '1', '35'],
            ['2026-03-05', 'Compra', 'WEGE3', '1', '35'],
            [46027, 'Compra', 'WEGE3', '1', '35']
          ])
        ])
      );

    const [portuguese, portugueseIso] = rowOf('Data');
    const [english, englishIso, englishSerial] = rowOf('Date');

    assert.equal(entryOf(portuguese).entry.tradeDate, '2026-05-03');
    assert.equal(entryOf(portugueseIso).entry.tradeDate, '2026-03-05');
    assert.deepEqual(problemsOf(english), ['ambiguous-date:date']);
    assert.equal(entryOf(englishIso).entry.tradeDate, '2026-03-05');
    assert.equal(entryOf(englishSerial).entry.tradeDate, '2026-01-05');
    assert.equal(
      entryOf(rowOf('Data da operação')[0]).entry.tradeDate,
      '2026-05-03'
    );
  });

  it('reads ambiguous text numbers as the other numbers of the sheet show, or in the convention of the file', () => {
    const header = ['Data', 'Tipo', 'Ativo', 'Quantidade', 'Preço', 'Taxas'];
    const sheet = sheetOf('compras.csv', [
      header,
      ['05/01/2026', 'C', 'WEGE3', '1.000', '35,20', '4,90']
    ]);
    const unclear = sheetOf('compras.csv', [
      header,
      ['05/01/2026', 'C', 'WEGE3', '1.000', '35', '']
    ]);
    const mixed = sheetOf('compras.csv', [
      header,
      ['05/01/2026', 'C', 'WEGE3', '1.000', '35,20', ''],
      ['05/01/2026', 'C', 'WEGE3', '2', '35.20', '']
    ]);

    const brazilian = entryOf(rowsOf(workbookOf([sheet], ','))[0]).entry;

    assert.equal(brazilian.quantity, '1000');
    assert.equal(brazilian.unitPrice, '35.2');
    assert.equal(brazilian.fees, '4.9');
    assert.equal(
      entryOf(rowsOf(workbookOf([sheet], '.'))[0]).entry.quantity,
      '1000'
    );
    assert.equal(
      entryOf(rowsOf(workbookOf([unclear], ','))[0]).entry.quantity,
      '1000'
    );
    assert.equal(
      entryOf(rowsOf(workbookOf([unclear], '.'))[0]).entry.quantity,
      '1'
    );
    assert.equal(
      entryOf(rowsOf(workbookOf([mixed], '.'))[0]).entry.quantity,
      '1'
    );
  });

  it('reads slashed dates under the English header in the order the file shows', () => {
    const datesOf = (days: ReadonlyArray<string>) =>
      rowsOf(
        workbookOf([
          sheetOf('s', [
            ['Date', 'Type', 'Symbol', 'Quantity', 'Price'],
            ...days.map((day) => [day, 'buy', 'WEGE3', '1', '35'])
          ])
        ])
      ).map((row) =>
        row.mapped.outcome === 'entry'
          ? row.mapped.entry.tradeDate
          : problemsOf(row).join()
      );

    assert.deepEqual(datesOf(['03/05/2026', '25/01/2026']), [
      '2026-05-03',
      '2026-01-25'
    ]);
    assert.deepEqual(datesOf(['03/05/2026', '01/25/2026']), [
      '2026-03-05',
      '2026-01-25'
    ]);
    assert.deepEqual(datesOf(['03/05/2026', '25/01/2026', '01/25/2026']), [
      'ambiguous-date:date',
      'ambiguous-date:date',
      'ambiguous-date:date'
    ]);
  });

  it('cuts a broker and notes to what EX3 stores, warning about it', () => {
    const rows = rowsOf(
      workbookOf([
        sheetOf('s', [
          [
            'Data',
            'Tipo',
            'Ativo',
            'Quantidade',
            'Preço',
            'Corretora',
            'Notas'
          ],
          [
            '05/01/2026',
            'Compra',
            'WEGE3',
            1,
            35,
            'B'.repeat(80),
            'N'.repeat(600)
          ]
        ])
      ])
    );
    const { entry: purchase, warnings } = entryOf(rows[0]);

    assert.equal(purchase.broker?.length, 60);
    assert.equal(purchase.notes?.length, 500);
    assert.deepEqual(warnings, ['broker-truncated', 'notes-truncated']);
  });
});

describe('readImportRows', () => {
  it('finds the header under a title, skipping sheets no format recognizes', () => {
    const reading = read(
      workbookOf([
        sheetOf('Capa', [
          ['Extrato de Negociação'],
          ['Período: 01/01/2026 a 31/01/2026']
        ]),
        sheetOf('Negociação', [
          ['Extrato de Negociação'],
          [],
          TRADES_HEADER,
          [
            '05/01/2026',
            'Compra',
            'Mercado à Vista',
            '-',
            'XP INVESTIMENTOS',
            'PETR4',
            100,
            30.5,
            3050
          ]
        ])
      ])
    );

    assert.equal(reading.outcome, 'read');
    assert.deepEqual(reading.formats, ['b3-trades']);
    assert.equal(reading.rows.length, 1);
    assert.equal(reading.rows[0].source.rowNumber, 4);
  });

  it('labels a column without a header by its position and a repeated header by both', () => {
    const rows = rowsOf(
      workbookOf([
        sheetOf('s', [
          ['Data', 'Tipo', 'Ativo', 'Quantidade', 'Preço', null, 'Preço'],
          ['05/01/2026', 'Compra', 'WEGE3', 1, 35, 'extra', 36]
        ])
      ])
    );

    assert.deepEqual(rows[0].source.cells, {
      Data: '05/01/2026',
      Tipo: 'Compra',
      Ativo: 'WEGE3',
      Quantidade: '1',
      Preço: '35',
      '#6': 'extra',
      'Preço #7': '36'
    });
    assert.equal(entryOf(rows[0]).entry.unitPrice, '35');
  });

  it('tells a file no format recognizes from one without data rows', () => {
    assert.deepEqual(
      read(
        workbookOf([
          sheetOf('s', [
            ['Nome', 'Valor'],
            ['a', 1]
          ])
        ])
      ),
      {
        outcome: 'unrecognized'
      }
    );
    assert.deepEqual(read(workbookOf([sheetOf('s', [TRADES_HEADER, []])])), {
      outcome: 'empty'
    });
  });

  it('refuses a file with more data rows than an import takes, whole', () => {
    const data = Array.from({ length: 3 }, () => [
      '05/01/2026',
      'Compra',
      'Mercado à Vista',
      '-',
      'XP INVESTIMENTOS',
      'PETR4',
      1,
      1,
      1
    ]);

    assert.deepEqual(
      read(workbookOf([sheetOf('s', [TRADES_HEADER, ...data])]), 2),
      {
        outcome: 'too-many-rows'
      }
    );
    assert.equal(
      read(workbookOf([sheetOf('s', [TRADES_HEADER, ...data])]), 3).outcome,
      'read'
    );
  });
});
