import { Prisma } from '@prisma/client';
import assert from 'node:assert/strict';
import {
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  mock,
  type Mock,
  type TestContext
} from 'node:test';

import {
  Errors,
  ImportLimits,
  MarketDataMessages,
  PortfolioMessages,
  TransactionImportMessages,
  UploadRoutes
} from '@/config';
import type {
  DescribedListing,
  ListingCatalog
} from '@/domain/MarketDataProvider';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { BrapiTickerCatalog, YahooFinanceProvider } from '@/infra/market-data';
import { apiRequest, bearer, signInWithPortfolio } from '@/test/ApiClient';
import { FakeMarketDataProvider } from '@/test/FakeMarketDataProvider';
import {
  createAsset,
  createPortfolio,
  createTransaction,
  FIXTURE_ASSET_SYMBOL,
  FIXTURE_PASSWORD,
  MISSING_UUID
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { workbookOf, type WorkbookCell } from '@/test/WorkbookBuilder';

const PREVIEW_ROUTE = UploadRoutes.TRANSACTION_IMPORT_PREVIEW;
const IMPORT_ROUTE = UploadRoutes.TRANSACTION_IMPORT;
const IMPORTS_ROUTE = '/v1/transaction-imports';

const importRoute = (id: string) => `/v1/transaction-import/${id}`;

const LISTED_SYMBOL = 'PETR4';
const BROKER = 'XP INVESTIMENTOS CCTVM S/A';

const PETR4_LISTING = {
  symbol: LISTED_SYMBOL,
  name: 'Petróleo Brasileiro S.A. - Petrobras',
  type: 'STOCK',
  market: 'B3',
  currency: 'BRL',
  sector: 'Energy'
} as const;

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

const tradeRow = (
  day: string,
  side: 'Compra' | 'Venda',
  quantity: number,
  price: number
): Array<WorkbookCell> => [
  day,
  side,
  'Mercado à Vista',
  '-',
  BROKER,
  LISTED_SYMBOL,
  quantity,
  price,
  quantity * price
];

const TRADES = [
  tradeRow('05/01/2026', 'Compra', 100, 30),
  tradeRow('06/01/2026', 'Venda', 40, 35)
];

type UploadedFile = Record<'name' | 'content', string>;

const tradingStatementOf = (
  rows: Array<Array<WorkbookCell>> = TRADES
): UploadedFile => ({
  name: 'negociacao.xlsx',
  content: workbookOf([
    { name: 'Negociação', rows: [TRADES_HEADER, ...rows] }
  ]).toString('base64')
});

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

const LISTED_PRODUCT = `${LISTED_SYMBOL} - PETROLEO BRASILEIRO S.A. PETROBRAS`;

const settlementRow = (
  day: string,
  direction: 'Credito' | 'Debito',
  quantity: number,
  price: number
): Array<WorkbookCell> => [
  direction,
  day,
  'Transferência - Liquidação',
  LISTED_PRODUCT,
  BROKER,
  quantity,
  price,
  quantity * price
];

const movementStatementOf = (
  rows: Array<Array<WorkbookCell>>
): UploadedFile => ({
  name: 'movimentacao.xlsx',
  content: workbookOf([
    { name: 'Movimentação', rows: [MOVEMENTS_HEADER, ...rows] }
  ]).toString('base64')
});

const templateOf = (lines: Array<string>): UploadedFile => ({
  name: 'ex3.csv',
  content: Buffer.from(
    ['Data;Tipo;Ativo;Quantidade;Preço;Taxas;Moeda', ...lines].join('\n'),
    'utf8'
  ).toString('base64')
});

const uploadOf = (content: Buffer, name = 'upload.xlsx'): UploadedFile => ({
  name,
  content: content.toString('base64')
});

type Caller = Awaited<ReturnType<typeof signInWithPortfolio>>;

const prismaClient = PrismaClient.getInstance();

const listFrom = (
  t: TestContext,
  provider: FakeMarketDataProvider = new FakeMarketDataProvider(
    {},
    { listings: [PETR4_LISTING] }
  )
) => {
  const yahooFinanceProvider = YahooFinanceProvider.getInstance();

  return {
    findListings: t.mock.method(
      yahooFinanceProvider,
      'findListings',
      (...args: Parameters<YahooFinanceProvider['findListings']>) =>
        provider.findListings(...args)
    ),
    describeListing: t.mock.method(
      yahooFinanceProvider,
      'describeListing',
      (...args: Parameters<YahooFinanceProvider['describeListing']>) =>
        provider.describeListing(...args)
    )
  };
};

const storedLedger = async () => ({
  instruments: await prismaClient.instrument.count(),
  positions: await prismaClient.position.count(),
  transactions: await prismaClient.transaction.count(),
  imports: await prismaClient.transactionImport.count()
});

describe('transaction imports', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  let getTickerListings: Mock<ListingCatalog['getListings']>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  beforeEach(() => {
    getTickerListings = mock.method(
      BrapiTickerCatalog.getInstance(),
      'getListings',
      async () => ({ outcome: 'unavailable' }) as const
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const preview = (
    { accessToken, portfolio }: Caller,
    file: UploadedFile,
    selectedKeys?: Array<string>
  ) =>
    client
      .post(PREVIEW_ROUTE)
      .set(bearer(accessToken))
      .send({
        portfolioId: portfolio.id,
        file,
        ...(selectedKeys !== undefined && { selectedKeys })
      });

  const record = (
    { accessToken, portfolio }: Caller,
    file: UploadedFile,
    selectedKeys: Array<string>
  ) =>
    client
      .post(IMPORT_ROUTE)
      .set(bearer(accessToken))
      .send({ portfolioId: portfolio.id, file, selectedKeys });

  const importAll = async (caller: Caller, file: UploadedFile) => {
    const previewed = await preview(caller, file);

    assert.equal(previewed.status, 200);

    const recorded = await record(
      caller,
      file,
      previewed.body.preview.selectedKeys
    );

    assert.equal(recorded.status, 201);

    return recorded;
  };

  const heldBitcoin = async (caller: Caller, quantity = '0') =>
    createAsset({
      portfolioId: caller.portfolio.id,
      quantity,
      averageCost: quantity === '0' ? '0' : '100',
      investedValue: quantity === '0' ? '0' : String(Number(quantity) * 100)
    });

  describe('preview', () => {
    it('reads a B3 trading statement and plans it without writing anything', async (t) => {
      const { findListings, describeListing } = listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await preview(caller, tradingStatementOf());

      assert.equal(res.status, 200);

      const { preview: plan } = res.body;

      assert.deepEqual(plan.file, {
        name: 'negociacao.xlsx',
        formats: ['b3-trades']
      });
      assert.equal(plan.counts.ready, 2);
      assert.equal(plan.selectedKeys.length, 2);
      assert.deepEqual(
        plan.rows.map(
          ({
            status,
            isSelected,
            rowNumber,
            entry
          }: Record<string, unknown> &
            Record<'entry', Record<string, unknown>>) => ({
            status,
            isSelected,
            rowNumber,
            type: entry.type,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            currency: entry.currency
          })
        ),
        [
          {
            status: 'ready',
            isSelected: true,
            rowNumber: 2,
            type: 'BUY',
            quantity: '100',
            unitPrice: '30',
            currency: 'BRL'
          },
          {
            status: 'ready',
            isSelected: true,
            rowNumber: 3,
            type: 'SELL',
            quantity: '40',
            unitPrice: '35',
            currency: 'BRL'
          }
        ]
      );
      assert.equal(plan.rows[0].sheet, 'Negociação');
      assert.equal(plan.rows[0].cells['Código de Negociação'], LISTED_SYMBOL);
      assert.equal(plan.rows[0].cells['Data do Negócio'], '05/01/2026');
      assert.deepEqual(plan.assets, [
        {
          symbol: LISTED_SYMBOL,
          resolution: 'listed',
          name: PETR4_LISTING.name,
          currency: 'BRL',
          rowCount: 2,
          selectedCount: 2,
          before: null,
          after: {
            quantity: '60',
            averageCost: '30',
            investedValue: '1800',
            realizedProfitLoss: '200'
          },
          netIncome: '0',
          refusal: null
        }
      ]);
      assert.equal(findListings.mock.callCount(), 1);
      assert.deepEqual(findListings.mock.calls[0].arguments, [
        new Map([[LISTED_SYMBOL, 'BRL']])
      ]);
      assert.equal(describeListing.mock.callCount(), 0);
      assert.deepEqual(await storedLedger(), {
        instruments: 0,
        positions: 0,
        transactions: 0,
        imports: 0
      });
    });

    it('shows the effect of the selected rows alone', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = tradingStatementOf();
      const [buyKey] = (await preview(caller, file)).body.preview.selectedKeys;

      const res = await preview(caller, file, [buyKey]);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.preview.selectedKeys, [buyKey]);
      assert.deepEqual(res.body.preview.assets[0].after, {
        quantity: '100',
        averageCost: '30',
        investedValue: '3000',
        realizedProfitLoss: '0'
      });
    });

    it('refuses the rows of an asset whose sales exceed what is held, telling where it stopped', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await heldBitcoin(caller);

      const res = await preview(
        caller,
        templateOf([`01/02/2026;Venda;${FIXTURE_ASSET_SYMBOL};5;150,00;;BRL`])
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.rows[0].status, 'refused');
      assert.equal(res.body.preview.rows[0].reason, 'oversold');
      assert.equal(res.body.preview.rows[0].isSelected, false);
      assert.deepEqual(res.body.preview.selectedKeys, []);
      assert.deepEqual(res.body.preview.assets[0].refusal, {
        reason: 'oversold',
        tradeDate: '2026-02-01',
        row: { sheet: '', rowNumber: 2 }
      });
    });

    it('flags a row that repeats a transaction of the portfolio, leaving it out unless selected', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const asset = await heldBitcoin(caller, '2');
      const transaction = await createTransaction(asset);
      const file = templateOf([
        `05/01/2026;Compra;${FIXTURE_ASSET_SYMBOL};2;50000;;BRL`
      ]);

      const res = await preview(caller, file);

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.rows[0].status, 'possible-duplicate');
      assert.equal(
        res.body.preview.rows[0].matchedTransactionId,
        transaction.id
      );
      assert.deepEqual(res.body.preview.selectedKeys, []);

      const selected = await preview(caller, file, [
        res.body.preview.rows[0].key
      ]);

      assert.deepEqual(selected.body.preview.selectedKeys, [
        res.body.preview.rows[0].key
      ]);
      assert.equal(selected.body.preview.assets[0].after.quantity, '4');
    });

    it('marks a symbol the provider does not list as unresolved', async (t) => {
      listFrom(t, new FakeMarketDataProvider({}, { listings: [] }));
      const caller = await signInWithPortfolio();

      const res = await preview(caller, tradingStatementOf());

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.counts.unresolved, 2);
      assert.equal(res.body.preview.rows[0].reason, 'not-listed');
      assert.deepEqual(res.body.preview.selectedKeys, []);
    });

    it('marks a new symbol unresolved while the provider is unavailable', async (t) => {
      listFrom(t, new FakeMarketDataProvider({}, { isAvailable: false }));
      const caller = await signInWithPortfolio();

      const res = await preview(caller, tradingStatementOf());

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.rows[0].reason, 'market-data-unavailable');
    });
  });

  describe('import', () => {
    it('records the selected rows, registering the listed asset for the caller alone, and rebuilds its position', async (t) => {
      const { describeListing } = listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await importAll(caller, tradingStatementOf());

      assert.equal(res.body.message, TransactionImportMessages.IMPORTED);
      assert.equal(res.body.transactionImport.fileName, 'negociacao.xlsx');
      assert.deepEqual(res.body.transactionImport.formats, ['b3-trades']);
      assert.equal(res.body.transactionImport.rowCount, 2);
      assert.equal(res.body.transactionImport.importedCount, 2);
      assert.equal(res.body.transactionImport.transactionCount, 2);
      assert.equal(res.body.transactionImport.undoneAt, null);
      assert.equal('fileDigest' in res.body.transactionImport, false);
      assert.equal(describeListing.mock.callCount(), 1);

      const instrument = await prismaClient.instrument.findFirstOrThrow({
        where: { symbol: LISTED_SYMBOL }
      });

      assert.equal(instrument.ownerId, caller.user.id);
      assert.equal(instrument.sector, PETR4_LISTING.sector);
      assert.deepEqual(res.body.transactionImport.openedInstrumentIds, [
        instrument.id
      ]);

      const position = await prismaClient.position.findFirstOrThrow({
        where: { portfolioId: caller.portfolio.id, instrumentId: instrument.id }
      });

      assert.equal(position.quantity.toFixed(), '60');
      assert.equal(position.averageCost.toFixed(), '30');
      assert.equal(position.investedValue.toFixed(), '1800');

      const transactions = await prismaClient.transaction.findMany({
        where: { portfolioId: caller.portfolio.id },
        orderBy: { sequence: 'asc' }
      });

      assert.deepEqual(
        transactions.map(({ type, executedAt, importId, importedRow }) => ({
          type,
          executedAt: executedAt.toISOString(),
          importId,
          format: (importedRow as Record<string, unknown>).format
        })),
        [
          {
            type: 'BUY',
            executedAt: '2026-01-05T03:00:00.000Z',
            importId: res.body.transactionImport.id,
            format: 'b3-trades'
          },
          {
            type: 'SELL',
            executedAt: '2026-01-06T03:00:00.000Z',
            importId: res.body.transactionImport.id,
            format: 'b3-trades'
          }
        ]
      );
      assert.equal(transactions[0].broker, BROKER);
    });

    it('registers a symbol the ticker catalog holds from it, with its sector, asking the provider nothing', async (t) => {
      const catalogListing: DescribedListing = {
        ...PETR4_LISTING,
        name: 'Petróleo Brasileiro S.A.',
        sector: 'Energy Minerals'
      };
      getTickerListings.mock.mockImplementation(async () => ({
        outcome: 'listed',
        listings: new Map([[LISTED_SYMBOL, catalogListing]])
      }));
      const { findListings, describeListing } = listFrom(t);
      const caller = await signInWithPortfolio();

      const previewed = await preview(caller, tradingStatementOf());

      assert.equal(previewed.status, 200);
      assert.equal(previewed.body.preview.assets[0].resolution, 'listed');
      assert.equal(previewed.body.preview.assets[0].name, catalogListing.name);

      const recorded = await record(
        caller,
        tradingStatementOf(),
        previewed.body.preview.selectedKeys
      );

      assert.equal(recorded.status, 201);

      const instrument = await prismaClient.instrument.findFirstOrThrow({
        where: { symbol: LISTED_SYMBOL }
      });

      assert.deepEqual(
        {
          name: instrument.name,
          type: instrument.type,
          market: instrument.market,
          currency: instrument.currency,
          sector: instrument.sector,
          ownerId: instrument.ownerId
        },
        {
          name: catalogListing.name,
          type: catalogListing.type,
          market: catalogListing.market,
          currency: catalogListing.currency,
          sector: catalogListing.sector,
          ownerId: caller.user.id
        }
      );
      assert.equal(findListings.mock.callCount(), 0);
      assert.equal(describeListing.mock.callCount(), 0);
    });

    it('records the trades and income of a B3 movement statement at the cost and result they replay to', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = movementStatementOf([
        settlementRow('07/01/2026', 'Credito', 100, 30),
        settlementRow('08/01/2026', 'Credito', 50, 36),
        settlementRow('09/01/2026', 'Debito', 60, 40),
        [
          'Credito',
          '09/01/2026',
          'Transferência',
          LISTED_PRODUCT,
          'NU INVEST',
          90,
          '-',
          '-'
        ],
        [
          'Credito',
          '12/01/2026',
          'Juros Sobre Capital Próprio',
          LISTED_PRODUCT,
          BROKER,
          90,
          0.1,
          7.65
        ]
      ]);

      const previewed = await preview(caller, file);

      assert.equal(previewed.status, 200);
      assert.deepEqual(previewed.body.preview.file.formats, ['b3-movements']);
      assert.equal(previewed.body.preview.counts.ready, 4);
      assert.equal(previewed.body.preview.counts.ignored, 1);
      assert.deepEqual(previewed.body.preview.assets[0].after, {
        quantity: '90',
        averageCost: '32',
        investedValue: '2880',
        realizedProfitLoss: '480'
      });
      assert.equal(previewed.body.preview.assets[0].netIncome, '7.65');

      const recorded = await record(
        caller,
        file,
        previewed.body.preview.selectedKeys
      );

      assert.equal(recorded.status, 201);

      const position = await prismaClient.position.findFirstOrThrow({
        where: { portfolioId: caller.portfolio.id }
      });

      assert.equal(position.quantity.toFixed(), '90');
      assert.equal(position.averageCost.toFixed(), '32');
      assert.equal(position.investedValue.toFixed(), '2880');

      const transactions = await prismaClient.transaction.findMany({
        where: { portfolioId: caller.portfolio.id },
        orderBy: { sequence: 'asc' }
      });

      assert.deepEqual(
        transactions.map(({ type, executedAt, unitPrice, taxes }) => [
          type,
          executedAt.toISOString(),
          unitPrice.toFixed(),
          taxes.toFixed()
        ]),
        [
          ['BUY', '2026-01-07T03:00:00.000Z', '30', '0'],
          ['BUY', '2026-01-08T03:00:00.000Z', '36', '0'],
          ['SELL', '2026-01-09T03:00:00.000Z', '40', '0'],
          ['JCP', '2026-01-12T03:00:00.000Z', '0.1', '1.35']
        ]
      );
    });

    it('flags the settlements of trades a trading statement imported as possible duplicates', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await importAll(caller, tradingStatementOf());

      const res = await preview(
        caller,
        movementStatementOf([
          settlementRow('07/01/2026', 'Credito', 100, 30),
          settlementRow('08/01/2026', 'Debito', 40, 35)
        ])
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.preview.counts['possible-duplicate'], 2);
      assert.deepEqual(res.body.preview.selectedKeys, []);
    });

    it('records a file once when it is imported twice at the same time', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = tradingStatementOf();
      const { selectedKeys } = (await preview(caller, file)).body.preview;

      const responses = await Promise.all([
        record(caller, file, selectedKeys),
        record(caller, file, selectedKeys)
      ]);

      assert.deepEqual(responses.map(({ status }) => status).toSorted(), [
        201,
        Errors.CONFLICT.status
      ]);
      assert.deepEqual(await storedLedger(), {
        instruments: 1,
        positions: 1,
        transactions: 2,
        imports: 1
      });
      assert.equal(
        (await prismaClient.position.findFirstOrThrow({})).quantity.toFixed(),
        '60'
      );
    });

    it('previews and records a statement of as many rows as one import reads, each purchase truncating the average cost once', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = movementStatementOf(
        Array.from({ length: ImportLimits.DATA_ROWS }, (_, index) =>
          settlementRow('07/01/2026', 'Credito', 1, 10 + (index % 100) / 100)
        )
      );

      const previewed = await preview(caller, file);

      assert.equal(previewed.status, 200);
      assert.equal(previewed.body.preview.counts.ready, ImportLimits.DATA_ROWS);

      const recorded = await record(
        caller,
        file,
        previewed.body.preview.selectedKeys
      );

      assert.equal(recorded.status, 201);
      assert.equal(
        await prismaClient.transaction.count(),
        ImportLimits.DATA_ROWS
      );

      const position = await prismaClient.position.findFirstOrThrow({});

      assert.equal(position.quantity.toFixed(), String(ImportLimits.DATA_ROWS));
      assert.ok(
        position.averageCost
          .sub('10.495')
          .abs()
          .lte(new Prisma.Decimal('1e-18').mul(ImportLimits.DATA_ROWS)),
        position.averageCost.toFixed()
      );
    });

    it('keeps what traces a transaction to its file out of the transaction API', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await importAll(caller, tradingStatementOf());

      const res = await client
        .get('/v1/transactions')
        .query({ portfolioId: caller.portfolio.id })
        .set(bearer(caller.accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 2);

      for (const item of res.body.items) {
        assert.equal('importKey' in item, false);
        assert.equal('importedRow' in item, false);
        assert.equal('importId' in item, false);
      }
    });

    it('records fees and taxes of the template on a held asset', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await heldBitcoin(caller);

      await importAll(
        caller,
        templateOf([
          `05/01/2026;Compra;${FIXTURE_ASSET_SYMBOL};0,5;300000;10,25;BRL`
        ])
      );

      const transaction = await prismaClient.transaction.findFirstOrThrow({});

      assert.equal(transaction.quantity.toFixed(), '0.5');
      assert.equal(transaction.unitPrice.toFixed(), '300000');
      assert.equal(transaction.fees.toFixed(), '10.25');

      const position = await prismaClient.position.findFirstOrThrow({});

      assert.equal(position.quantity.toFixed(), '0.5');
      assert.equal(position.investedValue.toFixed(), '150010.25');
    });

    it('records only the rows selected', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = tradingStatementOf();
      const [buyKey] = (await preview(caller, file)).body.preview.selectedKeys;

      const res = await record(caller, file, [buyKey]);

      assert.equal(res.status, 201);
      assert.equal(res.body.transactionImport.importedCount, 1);
      assert.equal(await prismaClient.transaction.count(), 1);
    });

    it('finds every row of a file imported again a duplicate, and refuses to record it twice', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = tradingStatementOf();
      const first = await importAll(caller, file);

      const again = await preview(caller, file);

      assert.equal(again.status, 200);
      assert.equal(again.body.preview.counts.duplicate, 2);
      assert.deepEqual(again.body.preview.selectedKeys, []);

      const repeated = await record(
        caller,
        file,
        first.body.result.selectedKeys
      );

      assert.equal(repeated.status, Errors.CONFLICT.status);
      assert.equal(repeated.body.message, TransactionImportMessages.CHANGED);
      assert.equal(await prismaClient.transaction.count(), 2);
      assert.equal(await prismaClient.transactionImport.count(), 1);
    });

    it('finds the rows of a longer statement already imported duplicates, recording only the new ones', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await importAll(caller, tradingStatementOf());

      const longer = tradingStatementOf([
        ...TRADES,
        tradeRow('07/01/2026', 'Compra', 10, 32)
      ]);
      const res = await preview(caller, longer);

      assert.equal(res.body.preview.counts.duplicate, 2);
      assert.equal(res.body.preview.counts.ready, 1);

      await record(caller, longer, res.body.preview.selectedKeys);

      assert.equal(await prismaClient.transaction.count(), 3);
      assert.equal(
        (await prismaClient.position.findFirstOrThrow({})).quantity.toFixed(),
        '70'
      );
    });

    it('records nothing when the portfolio changed since the preview', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const asset = await heldBitcoin(caller, '10');
      const purchase = await createTransaction(asset, {
        quantity: '10',
        unitPrice: '100'
      });
      const file = templateOf([
        `01/02/2026;Venda;${FIXTURE_ASSET_SYMBOL};10;150;;BRL`
      ]);
      const previewed = await preview(caller, file);

      assert.equal(previewed.body.preview.selectedKeys.length, 1);

      const deleted = await client
        .delete(`/v1/transaction/${purchase.id}`)
        .set(bearer(caller.accessToken));

      assert.equal(deleted.status, 200);

      const res = await record(
        caller,
        file,
        previewed.body.preview.selectedKeys
      );

      assert.equal(res.status, Errors.CONFLICT.status);
      assert.equal(res.body.message, TransactionImportMessages.CHANGED);
      assert.equal(await prismaClient.transaction.count(), 0);
      assert.equal(await prismaClient.transactionImport.count(), 0);
    });

    it('records nothing while the provider cannot describe a new asset', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const file = tradingStatementOf();
      const previewed = await preview(caller, file);
      t.mock.method(
        YahooFinanceProvider.getInstance(),
        'describeListing',
        async () => ({ outcome: 'unavailable' }) as const
      );

      const res = await record(
        caller,
        file,
        previewed.body.preview.selectedKeys
      );

      assert.equal(res.status, Errors.UNAVAILABLE.status);
      assert.equal(res.body.message, MarketDataMessages.UNAVAILABLE);
      assert.deepEqual(await storedLedger(), {
        instruments: 0,
        positions: 0,
        transactions: 0,
        imports: 0
      });
    });

    it('requires at least one selected row', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await record(caller, tradingStatementOf(), []);

      assert.equal(res.status, Errors.VALIDATION.status);
    });
  });

  describe('files', () => {
    const refusals: Array<[string, UploadedFile, string]> = [
      [
        'a legacy workbook',
        uploadOf(
          Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
          'old.xls'
        ),
        TransactionImportMessages.FILE_LEGACY
      ],
      [
        'a PDF',
        uploadOf(Buffer.from('%PDF-1.7\n'), 'nota.pdf'),
        TransactionImportMessages.FILE_UNSUPPORTED
      ],
      [
        'a damaged workbook',
        uploadOf(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])),
        TransactionImportMessages.FILE_MALFORMED
      ],
      [
        'a workbook whose name is not of a workbook',
        {
          ...movementStatementOf([
            settlementRow('03/11/2026', 'Credito', 10, 30)
          ]),
          name: 'movimentacao.csv'
        },
        TransactionImportMessages.FILE_UNSUPPORTED
      ],
      [
        'a text file named as a workbook',
        uploadOf(Buffer.from('a;b\n1;2\n'), 'other.xlsx'),
        TransactionImportMessages.FILE_UNSUPPORTED
      ],
      [
        'a text file of another kind',
        uploadOf(Buffer.from('a;b\n1;2\n'), 'other.txt'),
        TransactionImportMessages.FILE_UNSUPPORTED
      ],
      [
        'a table in no layout EX3 reads',
        uploadOf(Buffer.from('a;b\n1;2\n'), 'other.csv'),
        TransactionImportMessages.FORMAT_UNRECOGNIZED
      ],
      [
        'a statement with no rows',
        tradingStatementOf([]),
        TransactionImportMessages.NO_ROWS
      ]
    ];

    for (const [label, file, message] of refusals)
      it(`refuses ${label}`, async (t) => {
        const { findListings } = listFrom(t);
        const caller = await signInWithPortfolio();

        const res = await preview(caller, file);

        assert.equal(res.status, Errors.DOMAIN.status, label);
        assert.equal(res.body.message, message, label);
        assert.equal(findListings.mock.callCount(), 0);
      });

    it('refuses content that is not base64 and a name with control characters', async () => {
      const caller = await signInWithPortfolio();

      for (const file of [
        { name: 'file.csv', content: 'not base64!' },
        { name: 'file.csv', content: 'QUJD\nRA==' },
        { name: 'file\u0000.csv', content: 'QUJD' },
        { name: '', content: 'QUJD' }
      ]) {
        const res = await preview(caller, file);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(file)
        );
      }
    });

    it('refuses a file past the size one import reads', async () => {
      const caller = await signInWithPortfolio();

      const res = await preview(
        caller,
        uploadOf(Buffer.alloc(2 * 1024 * 1024 + 3, 'a'), 'big.csv')
      );

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.equal(
        res.body.details[0].message,
        TransactionImportMessages.FILE_TOO_LARGE
      );
    });

    it('refuses a body past the upload limit, and an anonymous upload before parsing it', async () => {
      const caller = await signInWithPortfolio();
      const body = {
        portfolioId: caller.portfolio.id,
        file: { name: 'big.csv', content: 'A'.repeat(4 * 1024 * 1024) }
      };

      const oversized = await client
        .post(PREVIEW_ROUTE)
        .set(bearer(caller.accessToken))
        .send(body);
      const anonymous = await client.post(PREVIEW_ROUTE).send(body);

      assert.equal(oversized.status, Errors.PAYLOAD_TOO_LARGE.status);
      assert.equal(anonymous.status, Errors.AUTHENTICATION.status);
    });

    it('keeps the small body limit on every other route', async () => {
      const caller = await signInWithPortfolio();

      const res = await client
        .post('/v1/portfolio')
        .set(bearer(caller.accessToken))
        .send({ name: 'A'.repeat(200 * 1024), baseCurrency: 'BRL' });

      assert.equal(res.status, Errors.PAYLOAD_TOO_LARGE.status);
    });
  });

  describe('history and undo', () => {
    it('lists the imports of a portfolio, newest first', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const first = await importAll(caller, tradingStatementOf([TRADES[0]]));
      const second = await importAll(caller, tradingStatementOf());

      const res = await client
        .get(IMPORTS_ROUTE)
        .query({ portfolioId: caller.portfolio.id })
        .set(bearer(caller.accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.total, 2);
      assert.deepEqual(
        res.body.items.map(
          ({ id, importedCount }: Record<'id' | 'importedCount', unknown>) => ({
            id,
            importedCount
          })
        ),
        [
          { id: second.body.transactionImport.id, importedCount: 1 },
          { id: first.body.transactionImport.id, importedCount: 1 }
        ]
      );
      assert.equal('fileDigest' in res.body.items[0], false);
    });

    it('undoes an import, closing the position it opened and keeping the import on record', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const imported = await importAll(caller, tradingStatementOf());
      const { id } = imported.body.transactionImport;

      const res = await client
        .delete(importRoute(id))
        .set(bearer(caller.accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.message, TransactionImportMessages.UNDONE);
      assert.equal(await prismaClient.transaction.count(), 0);
      assert.equal(await prismaClient.position.count(), 0);

      const stored = await prismaClient.transactionImport.findUniqueOrThrow({
        where: { id }
      });

      assert.notEqual(stored.undoneAt, null);

      const again = await client
        .delete(importRoute(id))
        .set(bearer(caller.accessToken));

      assert.equal(again.status, Errors.CONFLICT.status);
      assert.equal(
        again.body.message,
        TransactionImportMessages.ALREADY_UNDONE
      );

      const reimport = await preview(caller, tradingStatementOf());

      assert.equal(reimport.body.preview.counts.ready, 2);
    });

    it('undoes an import into a held position, rebuilding it from what is left', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const asset = await heldBitcoin(caller, '10');
      await createTransaction(asset, { quantity: '10', unitPrice: '100' });
      const imported = await importAll(
        caller,
        templateOf([`01/02/2026;Compra;${FIXTURE_ASSET_SYMBOL};5;160;;BRL`])
      );

      assert.equal(
        (await prismaClient.position.findFirstOrThrow({})).quantity.toFixed(),
        '15'
      );

      const res = await client
        .delete(importRoute(imported.body.transactionImport.id))
        .set(bearer(caller.accessToken));

      assert.equal(res.status, 200);

      const position = await prismaClient.position.findFirstOrThrow({});

      assert.equal(position.quantity.toFixed(), '10');
      assert.equal(position.averageCost.toFixed(), '100');
      assert.equal(await prismaClient.transaction.count(), 1);
    });

    it('refuses to undo an import a later sale depends on, touching nothing', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const imported = await importAll(caller, tradingStatementOf([TRADES[0]]));
      const sale = await client
        .post('/v1/transaction')
        .set(bearer(caller.accessToken))
        .send({
          portfolioId: caller.portfolio.id,
          assetSymbol: LISTED_SYMBOL,
          type: 'SELL',
          quantity: '100',
          unitPrice: '40',
          currency: 'BRL',
          executedAt: '2026-03-02T15:00:00.000Z'
        });

      assert.equal(sale.status, 201);

      const res = await client
        .delete(importRoute(imported.body.transactionImport.id))
        .set(bearer(caller.accessToken));

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal(res.body.message, TransactionImportMessages.UNDO_OVERSOLD);
      assert.equal(await prismaClient.transaction.count(), 2);
      assert.equal(
        (await prismaClient.transactionImport.findFirstOrThrow({})).undoneAt,
        null
      );
    });
  });

  describe('isolation', () => {
    it('answers another user’s portfolio and import as missing ones', async (t) => {
      listFrom(t);
      const owner = await signInWithPortfolio();
      const imported = await importAll(owner, tradingStatementOf());
      const intruder = await signInWithPortfolio('intruder@ex3.app');
      const intruding = { ...intruder, portfolio: owner.portfolio };
      const file = tradingStatementOf();

      const previewed = await preview(intruding, file);
      const recorded = await record(
        intruding,
        file,
        imported.body.result.selectedKeys
      );
      const listed = await client
        .get(IMPORTS_ROUTE)
        .query({ portfolioId: owner.portfolio.id })
        .set(bearer(intruder.accessToken));

      for (const res of [previewed, recorded, listed]) {
        assert.equal(res.status, Errors.NOT_FOUND.status);
        assert.equal(res.body.message, PortfolioMessages.NOT_FOUND);
      }

      for (const id of [imported.body.transactionImport.id, MISSING_UUID]) {
        const undone = await client
          .delete(importRoute(id))
          .set(bearer(intruder.accessToken));

        assert.equal(undone.status, Errors.NOT_FOUND.status);
        assert.equal(undone.body.message, TransactionImportMessages.NOT_FOUND);
      }

      assert.equal(await prismaClient.transaction.count(), 2);
    });

    it('plans against the caller’s own instruments, not another user’s private one', async (t) => {
      listFrom(t);
      const owner = await signInWithPortfolio();
      await importAll(owner, tradingStatementOf());
      const other = await signInWithPortfolio('other@ex3.app');

      const res = await preview(other, tradingStatementOf());

      assert.equal(res.body.preview.assets[0].resolution, 'listed');
      assert.equal(res.body.preview.counts.ready, 2);
    });

    it('requires a session', async () => {
      for (const res of [
        await client.post(PREVIEW_ROUTE).send({}),
        await client.post(IMPORT_ROUTE).send({}),
        await client.get(IMPORTS_ROUTE),
        await client.delete(importRoute(MISSING_UUID))
      ])
        assert.equal(res.status, Errors.AUTHENTICATION.status);
    });
  });

  describe('deletion', () => {
    it('deletes the imports of a deleted portfolio', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const other = await createPortfolio(caller.user.id, { name: 'Other' });
      await importAll({ ...caller, portfolio: other }, tradingStatementOf());

      const res = await client
        .delete('/v1/portfolio')
        .query({ portfolioId: other.id })
        .set(bearer(caller.accessToken));

      assert.equal(res.status, 200);
      assert.equal(await prismaClient.transactionImport.count(), 0);
      assert.equal(await prismaClient.transaction.count(), 0);
    });

    it('deletes the imports of a deleted account', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      await importAll(caller, tradingStatementOf());

      const res = await client
        .delete('/v1/user')
        .set(bearer(caller.accessToken))
        .send({ password: FIXTURE_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(await prismaClient.transactionImport.count(), 0);
      assert.equal(await prismaClient.instrument.count(), 0);
    });
  });
});
