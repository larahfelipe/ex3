import assert from 'node:assert/strict';
import { before, describe, it, type TestContext } from 'node:test';

import {
  AssetMessages,
  DecimalColumn,
  Errors,
  InstrumentMessages,
  InstrumentTypes,
  PortfolioMessages
} from '@/config';
import type { Instrument, Position } from '@/domain/models';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  apiRequest,
  bearer,
  signInSeeded,
  signInUser,
  signInWithPortfolio
} from '@/test/ApiClient';
import { FakeMarketDataProvider } from '@/test/FakeMarketDataProvider';
import {
  FIXTURE_EXECUTED_AT,
  MISSING_UUID,
  createAsset,
  createInstrument,
  createPortfolio,
  createTransaction,
  createUser
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const PORTFOLIO_ROUTE = '/v1/portfolio';
const PORTFOLIO_ALLOCATION_ROUTE = '/v1/portfolio/allocation';
const PORTFOLIO_OVERVIEW_ROUTE = '/v1/portfolio/overview';
const PORTFOLIO_PERFORMANCE_ROUTE = '/v1/portfolio/performance';
const PORTFOLIO_POSITIONS_ROUTE = '/v1/portfolio/positions';
const positionIndicatorsRoute = (symbol: string) =>
  `${PORTFOLIO_POSITIONS_ROUTE}/${encodeURIComponent(symbol)}/indicators`;
const PORTFOLIOS_ROUTE = '/v1/portfolios';

/** Mirror `CreatePortfolioSchema` and `Pagination`. */
const NAME_MAX_LENGTH = 60;
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

const OTHER_USER_EMAIL = 'other@ex3.app';

const MISSING_PORTFOLIO_ID = MISSING_UUID;

/**
 * Portfolios created one day apart, so the listing order by creation is total
 * and does not depend on the resolution of the database clock.
 */
const FIRST_CREATION_EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const HELD_PORTFOLIO_NAMES = ['First', 'Second', 'Third'];

const NAME_TAKEN_BODY = {
  code: Errors.CONFLICT.code,
  message: PortfolioMessages.NAME_TAKEN,
  details: [{ path: 'name', message: PortfolioMessages.NAME_TAKEN }]
};

/** The smallest positive value a quantity or monetary column holds. */
const COLUMN_UNIT = `0.${'0'.repeat(DecimalColumn.SCALE - 1)}1`;

const prismaClient = PrismaClient.getInstance();

const namesOf = (portfolios: ReadonlyArray<{ name: string }>) =>
  portfolios.map(({ name }) => name);

/** Inserted newest first, so only the creation instant can put them in order. */
const holdPortfolios = async (userId: string) => {
  for (const [index, name] of [...HELD_PORTFOLIO_NAMES.entries()].reverse())
    await createPortfolio(userId, {
      name,
      createdAt: new Date(FIRST_CREATION_EPOCH_MS + index * DAY_MS)
    });
};

describe('portfolios', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  describe('create', () => {
    const requestCreation = (accessToken: string, attributes: object) =>
      client.post(PORTFOLIO_ROUTE).set(bearer(accessToken)).send(attributes);

    it('creates a portfolio for the caller, trimming the name and upper-casing the currency', async () => {
      const { user, accessToken } = await signInUser();

      const res = await requestCreation(accessToken, {
        name: '  Retirement  ',
        baseCurrency: ' usd '
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, PortfolioMessages.CREATED);
      assert.equal(res.body.portfolio.name, 'Retirement');
      assert.equal(res.body.portfolio.baseCurrency, 'USD');
      assert.deepEqual(
        await prismaClient.portfolio.findMany({
          select: { id: true, userId: true }
        }),
        [{ id: res.body.portfolio.id, userId: user.id }]
      );
    });

    it('accepts a name of exactly the maximum length', async () => {
      const { accessToken } = await signInUser();

      const res = await requestCreation(accessToken, {
        name: 'P'.repeat(NAME_MAX_LENGTH),
        baseCurrency: 'BRL'
      });

      assert.equal(res.status, 201);
    });

    it('folds each run of whitespace in the name into one space', async () => {
      const { accessToken } = await signInUser();

      const res = await requestCreation(accessToken, {
        name: ' Long \t  term ',
        baseCurrency: 'BRL'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.portfolio.name, 'Long term');
    });

    it('refuses a name the caller already uses in any letter case or spacing, while another user may take it', async () => {
      const { user, accessToken } = await signInUser();
      const taken = await requestCreation(accessToken, {
        name: 'Long Term',
        baseCurrency: 'BRL'
      });

      assert.equal(taken.status, 201);

      for (const name of ['Long Term', 'long term', '  LONG   term ']) {
        const res = await requestCreation(accessToken, {
          name,
          baseCurrency: 'USD'
        });

        assert.equal(res.status, Errors.CONFLICT.status, name);
        assert.deepEqual(res.body, NAME_TAKEN_BODY);
      }

      assert.equal(
        await prismaClient.portfolio.count({ where: { userId: user.id } }),
        1
      );

      const other = await signInUser(OTHER_USER_EMAIL);
      const res = await requestCreation(other.accessToken, {
        name: 'Long Term',
        baseCurrency: 'BRL'
      });

      assert.equal(res.status, 201);
    });

    it('creates one portfolio of concurrent creations under one name', async () => {
      const { accessToken } = await signInUser();

      const responses = await Promise.all(
        ['Retirement', 'retirement', 'RETIREMENT'].map((name) =>
          requestCreation(accessToken, { name, baseCurrency: 'BRL' })
        )
      );

      assert.deepEqual(responses.map(({ status }) => status).toSorted(), [
        201,
        Errors.CONFLICT.status,
        Errors.CONFLICT.status
      ]);
      assert.equal(await prismaClient.portfolio.count(), 1);
    });

    it('rejects an invalid name or base currency and creates nothing', async () => {
      const { accessToken } = await signInUser();
      const valid = { name: 'Retirement', baseCurrency: 'BRL' };

      for (const attributes of [
        { ...valid, name: undefined },
        { ...valid, name: ' '.repeat(NAME_MAX_LENGTH) },
        { ...valid, name: 'P'.repeat(NAME_MAX_LENGTH + 1) },
        { ...valid, baseCurrency: undefined },
        { ...valid, baseCurrency: 'US' },
        { ...valid, baseCurrency: 'ZZZ' },
        { ...valid, baseCurrency: 986 }
      ]) {
        const res = await requestCreation(accessToken, attributes);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(attributes)
        );
      }

      assert.equal(await prismaClient.portfolio.count(), 0);
    });
  });

  describe('list', () => {
    it('lists only the caller portfolios, in the order they were created', async () => {
      const { user, accessToken } = await signInUser();
      const other = await createUser({ email: OTHER_USER_EMAIL });
      await createPortfolio(other.id);
      await holdPortfolios(user.id);

      const res = await client.get(PORTFOLIOS_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(namesOf(res.body.portfolios), HELD_PORTFOLIO_NAMES);
      assert.deepEqual(res.body.pagination, {
        page: 1,
        limit: DEFAULT_PAGE_LIMIT,
        total: HELD_PORTFOLIO_NAMES.length,
        totalPages: 1
      });
    });

    it('splits the listing into disjoint pages that cover all of it, the last one partial', async () => {
      const limit = 2;
      const totalPages = Math.ceil(HELD_PORTFOLIO_NAMES.length / limit);
      const { user, accessToken } = await signInUser();
      await holdPortfolios(user.id);

      const pagedNames = [];

      for (let page = 1; page <= totalPages; page += 1) {
        const res = await client
          .get(PORTFOLIOS_ROUTE)
          .query({ page, limit })
          .set(bearer(accessToken));

        assert.deepEqual(res.body.pagination, {
          page,
          limit,
          total: HELD_PORTFOLIO_NAMES.length,
          totalPages
        });
        pagedNames.push(namesOf(res.body.portfolios));
      }

      assert.deepEqual(pagedNames, [
        HELD_PORTFOLIO_NAMES.slice(0, limit),
        HELD_PORTFOLIO_NAMES.slice(limit)
      ]);
    });

    it('describes a caller without portfolios', async () => {
      const { accessToken } = await signInUser();

      const res = await client.get(PORTFOLIOS_ROUTE).set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        pagination: {
          page: 1,
          limit: DEFAULT_PAGE_LIMIT,
          total: 0,
          totalPages: 0
        },
        portfolios: []
      });
    });

    it('rejects a page size outside the bounds', async () => {
      const { accessToken } = await signInUser();

      for (const limit of [0, MAX_PAGE_LIMIT + 1]) {
        const res = await client
          .get(PORTFOLIOS_ROUTE)
          .query({ limit })
          .set(bearer(accessToken));

        assert.equal(res.status, Errors.VALIDATION.status, `${limit}`);
      }
    });
  });

  describe('get', () => {
    const requestPortfolio = (accessToken: string, portfolioId?: string) =>
      client
        .get(PORTFOLIO_ROUTE)
        .query({ portfolioId })
        .set(bearer(accessToken));

    it('returns a portfolio of the caller', async () => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id, {
        name: 'Retirement',
        baseCurrency: 'EUR'
      });

      const res = await requestPortfolio(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, portfolio.id);
      assert.equal(res.body.name, portfolio.name);
      assert.equal(res.body.baseCurrency, portfolio.baseCurrency);
    });

    it("answers another user's portfolio exactly like one that does not exist", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestPortfolio(accessToken, foreignPortfolio.id);
      const missing = await requestPortfolio(accessToken, MISSING_PORTFOLIO_ID);

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a missing or malformed portfolio id', async () => {
      const { accessToken } = await signInUser();

      for (const portfolioId of [undefined, 'not-a-uuid']) {
        const res = await requestPortfolio(accessToken, portfolioId);

        assert.equal(res.status, Errors.VALIDATION.status, `${portfolioId}`);
      }
    });
  });

  describe('update', () => {
    const requestUpdate = (accessToken: string, attributes: object) =>
      client.patch(PORTFOLIO_ROUTE).set(bearer(accessToken)).send(attributes);

    const storedPortfolio = (id: string) =>
      prismaClient.portfolio.findUniqueOrThrow({
        where: { id },
        select: { name: true, baseCurrency: true }
      });

    it('renames a portfolio of the caller and changes the base currency of one without transactions', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const res = await requestUpdate(accessToken, {
        portfolioId: portfolio.id,
        name: '  Brokerage  ',
        baseCurrency: ' usd '
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, PortfolioMessages.UPDATED);
      assert.equal(res.body.portfolio.id, portfolio.id);
      assert.deepEqual(await storedPortfolio(portfolio.id), {
        name: 'Brokerage',
        baseCurrency: 'USD'
      });
    });

    it('keeps the base currency of a portfolio with transactions, while a rename that restates it goes through', async () => {
      const { portfolio, accessToken } = await signInSeeded();

      const locked = await requestUpdate(accessToken, {
        portfolioId: portfolio.id,
        name: 'Renamed',
        baseCurrency: 'USD'
      });

      assert.equal(locked.status, Errors.DOMAIN.status);
      assert.equal(locked.body.code, Errors.DOMAIN.code);
      assert.equal(locked.body.message, PortfolioMessages.BASE_CURRENCY_LOCKED);
      assert.deepEqual(await storedPortfolio(portfolio.id), {
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency
      });

      const renamed = await requestUpdate(accessToken, {
        portfolioId: portfolio.id,
        name: 'Renamed',
        baseCurrency: portfolio.baseCurrency.toLowerCase()
      });

      assert.equal(renamed.status, 200);
      assert.deepEqual(await storedPortfolio(portfolio.id), {
        name: 'Renamed',
        baseCurrency: portfolio.baseCurrency
      });
    });

    it("refuses another portfolio's name of the caller, while its own name in another letter case and another user's name go through", async () => {
      const { user, portfolio, accessToken } = await signInWithPortfolio();
      const second = await createPortfolio(user.id, { name: 'Second' });
      const holder = await createUser({ email: OTHER_USER_EMAIL });
      const foreign = await createPortfolio(holder.id, { name: 'Foreign' });

      const taken = await requestUpdate(accessToken, {
        portfolioId: portfolio.id,
        name: ' second '
      });

      assert.equal(taken.status, Errors.CONFLICT.status);
      assert.deepEqual(taken.body, NAME_TAKEN_BODY);
      assert.deepEqual(await storedPortfolio(portfolio.id), {
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency
      });

      const recased = await requestUpdate(accessToken, {
        portfolioId: second.id,
        name: 'SECOND'
      });

      assert.equal(recased.status, 200);
      assert.equal((await storedPortfolio(second.id)).name, 'SECOND');

      const foreignName = await requestUpdate(accessToken, {
        portfolioId: portfolio.id,
        name: foreign.name
      });

      assert.equal(foreignName.status, 200);
      assert.equal((await storedPortfolio(portfolio.id)).name, foreign.name);
    });

    it("answers another user's portfolio exactly like one that does not exist, changing nothing", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestUpdate(accessToken, {
        portfolioId: foreignPortfolio.id,
        name: 'Taken'
      });
      const missing = await requestUpdate(accessToken, {
        portfolioId: MISSING_PORTFOLIO_ID,
        name: 'Taken'
      });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
      assert.deepEqual(await storedPortfolio(foreignPortfolio.id), {
        name: foreignPortfolio.name,
        baseCurrency: foreignPortfolio.baseCurrency
      });
    });

    it('rejects an update without attributes, with an invalid one or without a valid portfolio id, changing nothing', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();
      const portfolioId = portfolio.id;

      for (const attributes of [
        { portfolioId },
        { portfolioId, name: ' '.repeat(NAME_MAX_LENGTH) },
        { portfolioId, name: 'P'.repeat(NAME_MAX_LENGTH + 1) },
        { portfolioId, baseCurrency: 'ZZZ' },
        { portfolioId, baseCurrency: 986 },
        { name: 'Renamed' },
        { portfolioId: 'not-a-uuid', name: 'Renamed' }
      ]) {
        const res = await requestUpdate(accessToken, attributes);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(attributes)
        );
      }

      assert.deepEqual(await storedPortfolio(portfolioId), {
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency
      });
    });
  });

  describe('delete', () => {
    const requestDeletion = (accessToken: string, portfolioId?: string) =>
      client
        .delete(PORTFOLIO_ROUTE)
        .query({ portfolioId })
        .set(bearer(accessToken));

    const storedLedger = async () => ({
      portfolios: await prismaClient.portfolio.findMany({
        select: { id: true },
        orderBy: { id: 'asc' }
      }),
      positions: await prismaClient.position.findMany({
        select: { portfolioId: true },
        orderBy: { id: 'asc' }
      }),
      transactions: await prismaClient.transaction.findMany({
        select: { portfolioId: true },
        orderBy: { id: 'asc' }
      })
    });

    it('deletes a portfolio of the caller with its positions and transactions, keeping the other portfolios and the catalog', async () => {
      const { user, portfolio, asset, accessToken } = await signInSeeded();
      const kept = await createPortfolio(user.id, { name: 'Kept' });
      const keptAsset = await createAsset({
        portfolioId: kept.id,
        symbol: asset.symbol
      });

      await createTransaction(keptAsset);

      const res = await requestDeletion(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.equal(res.body.message, PortfolioMessages.DELETED);
      assert.deepEqual(await storedLedger(), {
        portfolios: [{ id: kept.id }],
        positions: [{ portfolioId: kept.id }],
        transactions: [{ portfolioId: kept.id }]
      });
      assert.equal(
        await prismaClient.instrument.count({
          where: { symbol: asset.symbol }
        }),
        1
      );
    });

    it('refuses to delete the last portfolio of the caller, keeping its positions and transactions', async () => {
      const { portfolio, accessToken } = await signInSeeded();
      const before = await storedLedger();

      const res = await requestDeletion(accessToken, portfolio.id);

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal(res.body.code, Errors.DOMAIN.code);
      assert.equal(res.body.message, PortfolioMessages.LAST_PORTFOLIO);
      assert.deepEqual(await storedLedger(), before);
    });

    it('keeps one portfolio when the last two are deleted at once', async () => {
      const { user, portfolio, accessToken } = await signInWithPortfolio();
      const second = await createPortfolio(user.id, { name: 'Second' });

      const responses = await Promise.all([
        requestDeletion(accessToken, portfolio.id),
        requestDeletion(accessToken, second.id)
      ]);

      assert.deepEqual(responses.map(({ status }) => status).toSorted(), [
        200,
        Errors.DOMAIN.status
      ]);
      assert.equal(await prismaClient.portfolio.count(), 1);
    });

    it("answers another user's portfolio exactly like one that does not exist, deleting nothing", async () => {
      const { portfolio: foreignPortfolio } = await signInSeeded();
      const { user, accessToken } = await signInUser(OTHER_USER_EMAIL);

      await createPortfolio(user.id);
      await createPortfolio(user.id, { name: 'Second' });

      const before = await storedLedger();

      const foreign = await requestDeletion(accessToken, foreignPortfolio.id);
      const missing = await requestDeletion(accessToken, MISSING_PORTFOLIO_ID);

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
      assert.deepEqual(await storedLedger(), before);
    });

    it('rejects a missing or malformed portfolio id', async () => {
      const { accessToken } = await signInWithPortfolio();

      for (const portfolioId of [undefined, 'not-a-uuid']) {
        const res = await requestDeletion(accessToken, portfolioId);

        assert.equal(res.status, Errors.VALIDATION.status, `${portfolioId}`);
      }

      assert.equal(await prismaClient.portfolio.count(), 1);
    });
  });

  const OBSERVED_AT = new Date('2026-09-11T19:55:00.000Z');
  const EARLIER = new Date('2026-09-11T19:50:00.000Z');

  const PETR4 = { symbol: 'PETR4', market: 'B3', currency: 'BRL' };
  const PETR4_POSITION = {
    quantity: '100',
    averageCost: '40',
    investedValue: '4000',
    ledgerCurrency: 'BRL'
  };

  const holdPosition = async (
    portfolioId: string,
    instrument: Pick<Instrument, 'symbol' | 'market' | 'currency'> &
      Partial<Pick<Instrument, 'name' | 'type' | 'sector'>>,
    {
      ledgerCurrency,
      ...stated
    }: Pick<Position, 'quantity' | 'averageCost' | 'investedValue'> &
      Record<'ledgerCurrency', string>
  ) => {
    await createInstrument(instrument);
    const asset = await createAsset({
      portfolioId,
      symbol: instrument.symbol,
      ...stated
    });
    await createTransaction(asset, {
      quantity: stated.quantity,
      unitPrice: stated.averageCost,
      currency: ledgerCurrency
    });
  };

  const quoteFrom = (t: TestContext, provider: FakeMarketDataProvider) => {
    const yahooFinanceProvider = YahooFinanceProvider.getInstance();

    return {
      getQuotes: t.mock.method(
        yahooFinanceProvider,
        'getQuotes',
        (...args: Parameters<YahooFinanceProvider['getQuotes']>) =>
          provider.getQuotes(...args)
      ),
      getExchangeRates: t.mock.method(
        yahooFinanceProvider,
        'getExchangeRates',
        (...args: Parameters<YahooFinanceProvider['getExchangeRates']>) =>
          provider.getExchangeRates(...args)
      )
    };
  };

  const historyFrom = (t: TestContext, provider: FakeMarketDataProvider) => {
    const yahooFinanceProvider = YahooFinanceProvider.getInstance();

    return {
      getHistoricalPrices: t.mock.method(
        yahooFinanceProvider,
        'getHistoricalPrices',
        (...args: Parameters<YahooFinanceProvider['getHistoricalPrices']>) =>
          provider.getHistoricalPrices(...args)
      ),
      getHistoricalExchangeRate: t.mock.method(
        yahooFinanceProvider,
        'getHistoricalExchangeRate',
        (
          ...args: Parameters<YahooFinanceProvider['getHistoricalExchangeRate']>
        ) => provider.getHistoricalExchangeRate(...args)
      )
    };
  };

  describe('overview', () => {
    const requestOverview = (accessToken: string, portfolioId?: string) =>
      client
        .get(PORTFOLIO_OVERVIEW_ROUTE)
        .query({ portfolioId })
        .set(bearer(accessToken));

    it('adds up the positions of the portfolio in its base currency, converted at the exchange rate', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      const otherPortfolio = await createPortfolio(user.id, { name: 'Other' });
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      await holdPosition(
        portfolio.id,
        { symbol: 'AAPL', market: 'NASDAQ', currency: 'USD' },
        {
          quantity: '2',
          averageCost: '400',
          investedValue: '800',
          ledgerCurrency: 'USD'
        }
      );
      await holdPosition(
        otherPortfolio.id,
        { symbol: 'VALE3', market: 'B3', currency: 'BRL' },
        {
          quantity: '10',
          averageCost: '60',
          investedValue: '600',
          ledgerCurrency: 'BRL'
        }
      );
      await createInstrument({
        symbol: 'OIBR3',
        market: 'B3',
        currency: 'BRL'
      });
      await createAsset({
        portfolioId: portfolio.id,
        symbol: 'OIBR3',
        quantity: '0',
        averageCost: '0',
        investedValue: '0'
      });
      const { getQuotes, getExchangeRates } = quoteFrom(
        t,
        new FakeMarketDataProvider({
          PETR4: [
            {
              price: '47.11',
              currency: 'BRL',
              timestamp: OBSERVED_AT,
              previousClose: '40'
            }
          ],
          AAPL: [
            {
              price: '229.5',
              currency: 'USD',
              timestamp: OBSERVED_AT,
              previousClose: '225'
            }
          ],
          VALE3: [{ price: '60', currency: 'BRL', timestamp: OBSERVED_AT }],
          USDBRL: [{ price: '5', currency: 'BRL', timestamp: EARLIER }]
        })
      );

      const res = await requestOverview(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'BRL',
        heldPositionCount: 2,
        totalValue: '7006',
        investedValue: '8000',
        profitLoss: '-994',
        profitLossPercent: '-0.12425',
        dayChange: '756',
        dayChangePercent: '0.12096',
        quotedAt: EARLIER.toISOString()
      });
      assert.deepEqual(
        getQuotes.mock.calls.map(({ arguments: [instruments] }) =>
          instruments
            .map(({ symbol }) => symbol)
            .toSorted((a, b) => a.localeCompare(b))
        ),
        [['AAPL', 'PETR4']]
      );
      assert.deepEqual(
        getExchangeRates.mock.calls.map(({ arguments: args }) => args),
        [[['USD'], 'BRL']]
      );
    });

    it('leaves out the totals that need a quote the provider could not give', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      quoteFrom(t, new FakeMarketDataProvider({}, { isAvailable: false }));

      const res = await requestOverview(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'BRL',
        heldPositionCount: 1,
        investedValue: '4000'
      });
    });

    it('describes a portfolio without positions in its base currency, with zero totals', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id, { baseCurrency: 'EUR' });
      quoteFrom(t, new FakeMarketDataProvider({}));

      const res = await requestOverview(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'EUR',
        heldPositionCount: 0,
        totalValue: '0',
        investedValue: '0',
        profitLoss: '0',
        dayChange: '0'
      });
    });

    it("answers another user's portfolio exactly like one that does not exist", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      await holdPosition(foreignPortfolio.id, PETR4, PETR4_POSITION);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestOverview(accessToken, foreignPortfolio.id);
      const missing = await requestOverview(accessToken, MISSING_PORTFOLIO_ID);

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a missing or malformed portfolio id', async () => {
      const { accessToken } = await signInUser();

      for (const portfolioId of [undefined, 'not-a-uuid']) {
        const res = await requestOverview(accessToken, portfolioId);

        assert.equal(res.status, Errors.VALIDATION.status, `${portfolioId}`);
      }
    });
  });

  describe('positions', () => {
    const SEARCH_MAX_LENGTH = 120;

    const NAMED_PETR4 = {
      ...PETR4,
      name: 'Petrobras',
      type: InstrumentTypes.STOCK
    };
    const AAPL = {
      symbol: 'AAPL',
      name: 'Apple',
      type: InstrumentTypes.STOCK,
      market: 'NASDAQ',
      currency: 'USD'
    };
    const OIBR3 = {
      symbol: 'OIBR3',
      name: 'Oi',
      type: InstrumentTypes.STOCK,
      market: 'B3',
      currency: 'BRL'
    };

    const AAPL_ITEM = {
      symbol: 'AAPL',
      name: 'Apple',
      quantity: '2',
      baseCurrency: 'BRL',
      averageCost: '2000',
      marketPrice: '2250',
      marketValue: '4500',
      allocation: '0.45',
      profitLoss: '500',
      profitLossPercent: '0.125'
    };
    const OIBR3_ITEM = {
      symbol: 'OIBR3',
      name: 'Oi',
      quantity: '0',
      baseCurrency: 'BRL',
      averageCost: '0',
      marketPrice: '1.5',
      marketValue: '0',
      allocation: '0',
      profitLoss: '0'
    };
    const PETR4_ITEM = {
      symbol: 'PETR4',
      name: 'Petrobras',
      quantity: '100',
      baseCurrency: 'BRL',
      averageCost: '40',
      marketPrice: '55',
      marketValue: '5500',
      allocation: '0.55',
      profitLoss: '1500',
      profitLossPercent: '0.375'
    };

    const requestPositions = (
      accessToken: string,
      query: Record<string, string | number | undefined>
    ) =>
      client
        .get(PORTFOLIO_POSITIONS_ROUTE)
        .query(query)
        .set(bearer(accessToken));

    const holdListedPositions = async (portfolioId: string) => {
      await holdPosition(portfolioId, NAMED_PETR4, PETR4_POSITION);
      await holdPosition(portfolioId, AAPL, {
        quantity: '2',
        averageCost: '400',
        investedValue: '800',
        ledgerCurrency: 'USD'
      });
      await createInstrument(OIBR3);
      await createAsset({
        portfolioId,
        symbol: OIBR3.symbol,
        quantity: '0',
        averageCost: '0',
        investedValue: '0'
      });
    };

    const pricedMarket = () =>
      new FakeMarketDataProvider({
        PETR4: [{ price: '55', currency: 'BRL', timestamp: OBSERVED_AT }],
        AAPL: [{ price: '450', currency: 'USD', timestamp: OBSERVED_AT }],
        OIBR3: [{ price: '1.5', currency: 'BRL', timestamp: OBSERVED_AT }],
        USDBRL: [{ price: '5', currency: 'BRL', timestamp: OBSERVED_AT }]
      });

    const quotedSymbols = ({
      mock
    }: ReturnType<typeof quoteFrom>['getQuotes']) =>
      mock.calls.map(({ arguments: [instruments] }) =>
        instruments
          .map(({ symbol }) => symbol)
          .toSorted((a, b) => a.localeCompare(b))
      );

    it('lists the positions of the portfolio in symbol order, valued in its base currency', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      const otherPortfolio = await createPortfolio(user.id, { name: 'Other' });
      await holdListedPositions(portfolio.id);
      await holdPosition(
        otherPortfolio.id,
        { symbol: 'VALE3', market: 'B3', currency: 'BRL' },
        {
          quantity: '10',
          averageCost: '60',
          investedValue: '600',
          ledgerCurrency: 'BRL'
        }
      );
      const { getQuotes, getExchangeRates } = quoteFrom(t, pricedMarket());

      const res = await requestPositions(accessToken, {
        portfolioId: portfolio.id
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        items: [AAPL_ITEM, OIBR3_ITEM, PETR4_ITEM],
        page: 1,
        pageSize: DEFAULT_PAGE_LIMIT,
        total: 3,
        totalPages: 1
      });
      assert.deepEqual(quotedSymbols(getQuotes), [['AAPL', 'OIBR3', 'PETR4']]);
      assert.deepEqual(
        getExchangeRates.mock.calls.map(({ arguments: args }) => args),
        [[['USD'], 'BRL']]
      );
    });

    it('pages the positions, quoting besides the listed ones only those with units', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdListedPositions(portfolio.id);
      const { getQuotes } = quoteFrom(t, pricedMarket());

      const lastPage = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        page: 2,
        pageSize: 2
      });
      const beyondLastPage = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        page: 3,
        pageSize: 2
      });

      assert.equal(lastPage.status, 200);
      assert.deepEqual(lastPage.body, {
        items: [PETR4_ITEM],
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2
      });
      assert.equal(beyondLastPage.status, 200);
      assert.deepEqual(beyondLastPage.body, {
        items: [],
        page: 3,
        pageSize: 2,
        total: 3,
        totalPages: 2
      });
      assert.deepEqual(quotedSymbols(getQuotes), [
        ['AAPL', 'PETR4'],
        ['AAPL', 'PETR4']
      ]);
    });

    it('lists the positions in reverse symbol order, quoting besides the listed ones only those with units', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdListedPositions(portfolio.id);
      const { getQuotes } = quoteFrom(t, pricedMarket());

      const firstPage = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        sortOrder: 'desc',
        pageSize: 2
      });
      const lastPage = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        sortOrder: 'desc',
        page: 2,
        pageSize: 2
      });

      assert.equal(firstPage.status, 200);
      assert.deepEqual(firstPage.body.items, [PETR4_ITEM, OIBR3_ITEM]);
      assert.equal(lastPage.status, 200);
      assert.deepEqual(lastPage.body.items, [AAPL_ITEM]);
      assert.deepEqual(quotedSymbols(getQuotes), [
        ['AAPL', 'OIBR3', 'PETR4'],
        ['AAPL', 'PETR4']
      ]);
    });

    it('sorts the positions by a value in either direction before paging, those without it last, quoting every position that matches', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdListedPositions(portfolio.id);
      const { getQuotes } = quoteFrom(t, pricedMarket());

      const byValue = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        sortBy: 'marketValue',
        sortOrder: 'desc',
        pageSize: 2
      });
      const byReturn = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        sortBy: 'profitLossPercent'
      });

      assert.equal(byValue.status, 200);
      assert.deepEqual(byValue.body, {
        items: [PETR4_ITEM, AAPL_ITEM],
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2
      });
      assert.equal(byReturn.status, 200);
      assert.deepEqual(byReturn.body.items, [
        AAPL_ITEM,
        PETR4_ITEM,
        OIBR3_ITEM
      ]);
      assert.deepEqual(quotedSymbols(getQuotes), [
        ['AAPL', 'OIBR3', 'PETR4'],
        ['AAPL', 'OIBR3', 'PETR4']
      ]);
    });

    it('filters the positions by a search, their type and whether they hold units, counting only those that match', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdListedPositions(portfolio.id);
      await holdPosition(
        portfolio.id,
        {
          symbol: 'BOVA11',
          name: 'iShares Ibovespa',
          type: InstrumentTypes.ETF,
          market: 'B3',
          currency: 'BRL'
        },
        {
          quantity: '10',
          averageCost: '100',
          investedValue: '1000',
          ledgerCurrency: 'BRL'
        }
      );
      quoteFrom(t, pricedMarket());

      for (const [filter, expected] of [
        [{ search: 'BRAS' }, { symbols: ['PETR4'], total: 1, totalPages: 1 }],
        [{ search: 'oi' }, { symbols: ['OIBR3'], total: 1, totalPages: 1 }],
        [{ type: 'ETF' }, { symbols: ['BOVA11'], total: 1, totalPages: 1 }],
        [
          { type: 'STOCK' },
          { symbols: ['AAPL', 'OIBR3', 'PETR4'], total: 3, totalPages: 1 }
        ],
        [
          { status: 'open' },
          { symbols: ['AAPL', 'BOVA11', 'PETR4'], total: 3, totalPages: 1 }
        ],
        [{ status: 'closed' }, { symbols: ['OIBR3'], total: 1, totalPages: 1 }],
        [
          { type: 'STOCK', status: 'open', pageSize: 1 },
          { symbols: ['AAPL'], total: 2, totalPages: 2 }
        ],
        [{ search: 'VALE' }, { symbols: [], total: 0, totalPages: 0 }]
      ] as const) {
        const res = await requestPositions(accessToken, {
          portfolioId: portfolio.id,
          ...filter
        });

        assert.equal(res.status, 200, JSON.stringify(filter));
        assert.deepEqual(
          {
            symbols: res.body.items.map(
              ({ symbol }: { symbol: string }) => symbol
            ),
            total: res.body.total,
            totalPages: res.body.totalPages
          },
          expected,
          JSON.stringify(filter)
        );
      }
    });

    it('lists the positions without the values that need a quote the provider could not give', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, NAMED_PETR4, PETR4_POSITION);
      quoteFrom(t, new FakeMarketDataProvider({}, { isAvailable: false }));

      const res = await requestPositions(accessToken, {
        portfolioId: portfolio.id
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        items: [
          {
            symbol: 'PETR4',
            name: 'Petrobras',
            quantity: '100',
            baseCurrency: 'BRL',
            averageCost: '40'
          }
        ],
        page: 1,
        pageSize: DEFAULT_PAGE_LIMIT,
        total: 1,
        totalPages: 1
      });
    });

    it('describes a portfolio without positions as an empty page, at the largest page size', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      quoteFrom(t, new FakeMarketDataProvider({}));

      const res = await requestPositions(accessToken, {
        portfolioId: portfolio.id,
        pageSize: MAX_PAGE_LIMIT
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        items: [],
        page: 1,
        pageSize: MAX_PAGE_LIMIT,
        total: 0,
        totalPages: 0
      });
    });

    it("answers another user's portfolio exactly like one that does not exist", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      await holdPosition(foreignPortfolio.id, PETR4, PETR4_POSITION);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestPositions(accessToken, {
        portfolioId: foreignPortfolio.id
      });
      const missing = await requestPositions(accessToken, {
        portfolioId: MISSING_PORTFOLIO_ID
      });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a missing or malformed portfolio id, page, page size, sort, search, type or status', async () => {
      const { accessToken } = await signInUser();

      for (const query of [
        {},
        { portfolioId: 'not-a-uuid' },
        { portfolioId: MISSING_PORTFOLIO_ID, page: 0 },
        { portfolioId: MISSING_PORTFOLIO_ID, page: 1.5 },
        { portfolioId: MISSING_PORTFOLIO_ID, pageSize: 0 },
        { portfolioId: MISSING_PORTFOLIO_ID, pageSize: MAX_PAGE_LIMIT + 1 },
        { portfolioId: MISSING_PORTFOLIO_ID, sortBy: 'name' },
        { portfolioId: MISSING_PORTFOLIO_ID, sortOrder: 'up' },
        { portfolioId: MISSING_PORTFOLIO_ID, search: ' ' },
        {
          portfolioId: MISSING_PORTFOLIO_ID,
          search: 'A'.repeat(SEARCH_MAX_LENGTH + 1)
        },
        { portfolioId: MISSING_PORTFOLIO_ID, type: 'SHARE' },
        { portfolioId: MISSING_PORTFOLIO_ID, status: 'sold' }
      ]) {
        const res = await requestPositions(accessToken, query);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(query)
        );
      }
    });

    describe('by symbol', () => {
      const SYMBOL_MAX_LENGTH = 6;

      const AAPL_CATALOG = {
        type: InstrumentTypes.STOCK,
        market: 'NASDAQ',
        currency: 'USD',
        sector: null
      };

      const requestPosition = (
        accessToken: string,
        symbol: string,
        portfolioId?: string
      ) =>
        client
          .get(`${PORTFOLIO_POSITIONS_ROUTE}/${encodeURIComponent(symbol)}`)
          .query({ portfolioId })
          .set(bearer(accessToken));

      it('describes a position of the portfolio valued in its base currency, next to its catalog and the quote it was valued at', async (t) => {
        const { user, accessToken } = await signInUser();
        const portfolio = await createPortfolio(user.id);
        await holdListedPositions(portfolio.id);
        const { getQuotes, getExchangeRates } = quoteFrom(
          t,
          new FakeMarketDataProvider({
            PETR4: [{ price: '55', currency: 'BRL', timestamp: OBSERVED_AT }],
            AAPL: [
              {
                price: '450',
                currency: 'USD',
                timestamp: OBSERVED_AT,
                previousClose: '400'
              }
            ],
            USDBRL: [{ price: '5', currency: 'BRL', timestamp: OBSERVED_AT }]
          })
        );

        const res = await requestPosition(accessToken, 'aapl', portfolio.id);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
          ...AAPL_ITEM,
          ...AAPL_CATALOG,
          quote: {
            price: '450',
            currency: 'USD',
            timestamp: OBSERVED_AT.toISOString(),
            previousClose: '400',
            dayChange: '50',
            dayChangePercent: '0.125'
          }
        });
        assert.deepEqual(quotedSymbols(getQuotes), [['AAPL', 'PETR4']]);
        assert.deepEqual(
          getExchangeRates.mock.calls.map(({ arguments: args }) => args),
          [[['USD'], 'BRL']]
        );
      });

      it('describes a position without units, quoting it besides those with units', async (t) => {
        const { user, accessToken } = await signInUser();
        const portfolio = await createPortfolio(user.id);
        await holdListedPositions(portfolio.id);
        const { getQuotes } = quoteFrom(t, pricedMarket());

        const res = await requestPosition(accessToken, 'OIBR3', portfolio.id);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
          ...OIBR3_ITEM,
          type: InstrumentTypes.STOCK,
          market: 'B3',
          currency: 'BRL',
          sector: null,
          quote: {
            price: '1.5',
            currency: 'BRL',
            timestamp: OBSERVED_AT.toISOString()
          }
        });
        assert.deepEqual(quotedSymbols(getQuotes), [
          ['AAPL', 'OIBR3', 'PETR4']
        ]);
      });

      it('describes the position without the quote and the values that need one the provider could not give', async (t) => {
        const { user, accessToken } = await signInUser();
        const portfolio = await createPortfolio(user.id);
        await holdListedPositions(portfolio.id);
        quoteFrom(t, new FakeMarketDataProvider({}, { isAvailable: false }));

        const res = await requestPosition(accessToken, 'AAPL', portfolio.id);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
          symbol: 'AAPL',
          name: 'Apple',
          quantity: '2',
          baseCurrency: 'BRL',
          ...AAPL_CATALOG
        });
      });

      it('refuses a symbol the portfolio does not hold, even one another portfolio of the caller holds', async (t) => {
        const { user, accessToken } = await signInUser();
        const portfolio = await createPortfolio(user.id);
        const otherPortfolio = await createPortfolio(user.id, {
          name: 'Other'
        });
        await holdPosition(portfolio.id, NAMED_PETR4, PETR4_POSITION);
        await holdPosition(otherPortfolio.id, AAPL, {
          quantity: '2',
          averageCost: '400',
          investedValue: '800',
          ledgerCurrency: 'USD'
        });
        const { getQuotes } = quoteFrom(t, pricedMarket());

        for (const symbol of ['AAPL', 'NONE']) {
          const res = await requestPosition(accessToken, symbol, portfolio.id);

          assert.equal(res.status, Errors.NOT_FOUND.status, symbol);
          assert.equal(res.body.message, AssetMessages.NOT_FOUND);
        }
        assert.equal(getQuotes.mock.callCount(), 0);
      });

      it('answers small values in plain decimal notation, without an exponent', async (t) => {
        const { user, accessToken } = await signInUser();
        const portfolio = await createPortfolio(user.id);
        await holdPosition(portfolio.id, PETR4, {
          quantity: COLUMN_UNIT,
          averageCost: COLUMN_UNIT,
          investedValue: '0',
          ledgerCurrency: 'BRL'
        });
        quoteFrom(
          t,
          new FakeMarketDataProvider({
            PETR4: [
              { price: COLUMN_UNIT, currency: 'BRL', timestamp: OBSERVED_AT }
            ]
          })
        );

        const res = await requestPosition(
          accessToken,
          PETR4.symbol,
          portfolio.id
        );

        assert.equal(res.status, 200);
        assert.equal(res.body.quantity, COLUMN_UNIT);
        assert.equal(res.body.averageCost, COLUMN_UNIT);
        assert.equal(res.body.marketPrice, COLUMN_UNIT);
      });

      it("answers another user's portfolio exactly like one that does not exist", async () => {
        const holder = await createUser();
        const foreignPortfolio = await createPortfolio(holder.id);
        await holdPosition(foreignPortfolio.id, PETR4, PETR4_POSITION);
        const { accessToken } = await signInUser(OTHER_USER_EMAIL);

        const foreign = await requestPosition(
          accessToken,
          PETR4.symbol,
          foreignPortfolio.id
        );
        const missing = await requestPosition(
          accessToken,
          PETR4.symbol,
          MISSING_PORTFOLIO_ID
        );

        assert.equal(foreign.status, Errors.NOT_FOUND.status);
        assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
        assert.deepEqual(foreign.body, missing.body);
      });

      it('rejects a missing or malformed portfolio id or symbol', async () => {
        const { accessToken } = await signInUser();

        for (const [symbol, portfolioId] of [
          ['PETR4', undefined],
          ['PETR4', 'not-a-uuid'],
          [' ', MISSING_PORTFOLIO_ID],
          ['A'.repeat(SYMBOL_MAX_LENGTH + 1), MISSING_PORTFOLIO_ID]
        ] as const) {
          const res = await requestPosition(accessToken, symbol, portfolioId);

          assert.equal(
            res.status,
            Errors.VALIDATION.status,
            JSON.stringify({ symbol, portfolioId })
          );
        }
      });
    });
  });

  describe('allocation', () => {
    const ENERGY_PETR4 = {
      ...PETR4,
      name: 'Petrobras',
      type: InstrumentTypes.STOCK,
      sector: 'Energy'
    };

    const requestAllocation = (accessToken: string, portfolioId?: string) =>
      client
        .get(PORTFOLIO_ALLOCATION_ROUTE)
        .query({ portfolioId })
        .set(bearer(accessToken));

    it('breaks the positions of the portfolio with units down by asset, type, sector and currency, in its base currency', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      const otherPortfolio = await createPortfolio(user.id, { name: 'Other' });
      await holdPosition(portfolio.id, ENERGY_PETR4, PETR4_POSITION);
      await holdPosition(
        portfolio.id,
        {
          symbol: 'AAPL',
          name: 'Apple',
          type: InstrumentTypes.STOCK,
          sector: 'Technology',
          market: 'NASDAQ',
          currency: 'USD'
        },
        {
          quantity: '2',
          averageCost: '400',
          investedValue: '800',
          ledgerCurrency: 'USD'
        }
      );
      await holdPosition(
        portfolio.id,
        {
          symbol: 'XPML11',
          name: 'XP Malls',
          type: InstrumentTypes.REIT,
          market: 'B3',
          currency: 'BRL'
        },
        {
          quantity: '10',
          averageCost: '90',
          investedValue: '900',
          ledgerCurrency: 'BRL'
        }
      );
      await holdPosition(
        otherPortfolio.id,
        {
          symbol: 'VALE3',
          type: InstrumentTypes.STOCK,
          sector: 'Materials',
          market: 'B3',
          currency: 'BRL'
        },
        {
          quantity: '10',
          averageCost: '60',
          investedValue: '600',
          ledgerCurrency: 'BRL'
        }
      );
      await createInstrument({
        symbol: 'OIBR3',
        type: InstrumentTypes.STOCK,
        sector: 'Telecom',
        market: 'B3',
        currency: 'BRL'
      });
      await createAsset({
        portfolioId: portfolio.id,
        symbol: 'OIBR3',
        quantity: '0',
        averageCost: '0',
        investedValue: '0'
      });
      const { getQuotes, getExchangeRates } = quoteFrom(
        t,
        new FakeMarketDataProvider({
          PETR4: [{ price: '50', currency: 'BRL', timestamp: OBSERVED_AT }],
          AAPL: [{ price: '400', currency: 'USD', timestamp: OBSERVED_AT }],
          XPML11: [{ price: '100', currency: 'BRL', timestamp: OBSERVED_AT }],
          VALE3: [{ price: '60', currency: 'BRL', timestamp: OBSERVED_AT }],
          OIBR3: [{ price: '1.5', currency: 'BRL', timestamp: OBSERVED_AT }],
          USDBRL: [{ price: '5', currency: 'BRL', timestamp: OBSERVED_AT }]
        })
      );

      const res = await requestAllocation(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'BRL',
        totalValue: '10000',
        byAsset: [
          {
            symbol: 'AAPL',
            name: 'Apple',
            marketValue: '4000',
            allocation: '0.4'
          },
          {
            symbol: 'PETR4',
            name: 'Petrobras',
            marketValue: '5000',
            allocation: '0.5'
          },
          {
            symbol: 'XPML11',
            name: 'XP Malls',
            marketValue: '1000',
            allocation: '0.1'
          }
        ],
        byType: [
          { type: 'REIT', marketValue: '1000', allocation: '0.1' },
          { type: 'STOCK', marketValue: '9000', allocation: '0.9' }
        ],
        bySector: [
          { sector: 'Energy', marketValue: '5000', allocation: '0.5' },
          { sector: 'Technology', marketValue: '4000', allocation: '0.4' },
          { sector: null, marketValue: '1000', allocation: '0.1' }
        ],
        byCurrency: [
          { currency: 'BRL', marketValue: '6000', allocation: '0.6' },
          { currency: 'USD', marketValue: '4000', allocation: '0.4' }
        ]
      });
      assert.deepEqual(
        getQuotes.mock.calls.map(({ arguments: [instruments] }) =>
          instruments
            .map(({ symbol }) => symbol)
            .toSorted((a, b) => a.localeCompare(b))
        ),
        [['AAPL', 'PETR4', 'XPML11']]
      );
      assert.deepEqual(
        getExchangeRates.mock.calls.map(({ arguments: args }) => args),
        [[['USD'], 'BRL']]
      );
    });

    it('breaks the portfolio down without the values and shares that need a quote the provider could not give', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, ENERGY_PETR4, PETR4_POSITION);
      quoteFrom(t, new FakeMarketDataProvider({}, { isAvailable: false }));

      const res = await requestAllocation(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'BRL',
        byAsset: [{ symbol: 'PETR4', name: 'Petrobras' }],
        byType: [{ type: 'STOCK' }],
        bySector: [{ sector: 'Energy' }],
        byCurrency: [{ currency: 'BRL' }]
      });
    });

    it('describes a portfolio without positions in its base currency, worth zero with nothing to break down', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id, { baseCurrency: 'EUR' });
      quoteFrom(t, new FakeMarketDataProvider({}));

      const res = await requestAllocation(accessToken, portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'EUR',
        totalValue: '0',
        byAsset: [],
        byType: [],
        bySector: [],
        byCurrency: []
      });
    });

    it("answers another user's portfolio exactly like one that does not exist", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      await holdPosition(foreignPortfolio.id, ENERGY_PETR4, PETR4_POSITION);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestAllocation(accessToken, foreignPortfolio.id);
      const missing = await requestAllocation(
        accessToken,
        MISSING_PORTFOLIO_ID
      );

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a missing or malformed portfolio id', async () => {
      const { accessToken } = await signInUser();

      for (const portfolioId of [undefined, 'not-a-uuid']) {
        const res = await requestAllocation(accessToken, portfolioId);

        assert.equal(res.status, Errors.VALIDATION.status, `${portfolioId}`);
      }
    });
  });

  describe('performance', () => {
    const BENCHMARK = { symbol: 'BOVA11', market: 'B3', currency: 'BRL' };

    /**
     * The window is resolved from the current day, so the closes are seeded
     * relative to it instead of at fixed dates the suite would outlive.
     */
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const monthBefore = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate())
    );
    const closedOn = (daysBefore: number) =>
      new Date(startOfToday.getTime() - daysBefore * DAY_MS);

    type SeededClose = Record<'price' | 'currency', string> &
      Record<'timestamp', Date>;

    const closesOf = (
      currency: string,
      ...prices: [string, ...Array<string>]
    ): [SeededClose, ...Array<SeededClose>] => {
      const [first, ...rest] = prices;
      const closedAt = (price: string, index: number) => ({
        price,
        currency,
        timestamp: closedOn(prices.length - index)
      });

      return [
        closedAt(first, 0),
        ...rest.map((price, index) => closedAt(price, index + 1))
      ];
    };

    const requestPerformance = (
      accessToken: string,
      query: Record<string, string | undefined>
    ) =>
      client
        .get(PORTFOLIO_PERFORMANCE_ROUTE)
        .query(query)
        .set(bearer(accessToken));

    it('values the portfolio at each daily close of the window, in its base currency', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      const { getHistoricalPrices } = historyFrom(
        t,
        new FakeMarketDataProvider({ PETR4: closesOf('BRL', '50', '55') })
      );

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        range: '1M'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'BRL',
        from: monthBefore.toISOString(),
        to: startOfToday.toISOString(),
        series: [
          {
            date: closedOn(2).toISOString(),
            value: '5000',
            investedValue: '4000',
            netContribution: '0',
            twr: '0'
          },
          {
            date: closedOn(1).toISOString(),
            value: '5500',
            investedValue: '4000',
            netContribution: '0',
            twr: '0.1'
          }
        ]
      });
      assert.deepEqual(getHistoricalPrices.mock.calls[0].arguments[1], {
        from: monthBefore,
        to: startOfToday
      });
    });

    it('takes a position quoted in another currency to the base currency at the rate of each day', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(
        portfolio.id,
        { symbol: 'AAPL', market: 'NASDAQ', currency: 'USD' },
        {
          quantity: '2',
          averageCost: '400',
          investedValue: '800',
          ledgerCurrency: 'USD'
        }
      );
      const { getHistoricalExchangeRate } = historyFrom(
        t,
        new FakeMarketDataProvider({
          AAPL: closesOf('USD', '400', '450'),
          USDBRL: closesOf('BRL', '5', '5')
        })
      );

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        range: '1M'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.series.map(
          ({ value, investedValue, twr }: Record<string, string>) => ({
            value,
            investedValue,
            twr
          })
        ),
        [
          { value: '4000', investedValue: '4000', twr: '0' },
          { value: '4500', investedValue: '4000', twr: '0.125' }
        ]
      );
      assert.deepEqual(
        getHistoricalExchangeRate.mock.calls.map(({ arguments: args }) =>
          args.slice(0, 2)
        ),
        [['USD', 'BRL']]
      );
    });

    it('returns the benchmark of the window next to the portfolio', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      await createInstrument(BENCHMARK);
      historyFrom(
        t,
        new FakeMarketDataProvider({
          PETR4: closesOf('BRL', '50', '55'),
          BOVA11: closesOf('BRL', '120', '132')
        })
      );

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        range: '1M',
        benchmark: BENCHMARK.symbol
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.benchmark, {
        symbol: 'BOVA11',
        currency: 'BRL',
        series: [
          { date: closedOn(2).toISOString(), close: '120', twr: '0' },
          { date: closedOn(1).toISOString(), close: '132', twr: '0.1' }
        ]
      });
    });

    it('follows only the position of the symbol, from its own transactions', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      await holdPosition(
        portfolio.id,
        { symbol: 'AAPL', market: 'NASDAQ', currency: 'USD' },
        {
          quantity: '2',
          averageCost: '400',
          investedValue: '800',
          ledgerCurrency: 'USD'
        }
      );
      const { getHistoricalPrices, getHistoricalExchangeRate } = historyFrom(
        t,
        new FakeMarketDataProvider({
          PETR4: closesOf('BRL', '50', '55'),
          AAPL: closesOf('USD', '400', '450'),
          USDBRL: closesOf('BRL', '5', '5')
        })
      );

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        range: '1M',
        symbol: 'petr4'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.series.map(
          ({ value, investedValue, twr }: Record<string, string>) => ({
            value,
            investedValue,
            twr
          })
        ),
        [
          { value: '5000', investedValue: '4000', twr: '0' },
          { value: '5500', investedValue: '4000', twr: '0.1' }
        ]
      );
      assert.deepEqual(
        getHistoricalPrices.mock.calls.map(
          ({ arguments: [{ symbol }] }) => symbol
        ),
        ['PETR4']
      );
      assert.equal(getHistoricalExchangeRate.mock.callCount(), 0);
    });

    it('refuses a symbol the portfolio does not hold', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      await createInstrument(BENCHMARK);
      historyFrom(t, new FakeMarketDataProvider({}));

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        symbol: BENCHMARK.symbol
      });

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, AssetMessages.NOT_FOUND);
    });

    it('refuses a benchmark outside the catalog', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      historyFrom(t, new FakeMarketDataProvider({}));

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        benchmark: 'NONE'
      });

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, InstrumentMessages.NOT_FOUND);
    });

    it("refuses another user's private instrument as a benchmark, like one outside the catalog", async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      const other = await createUser({ email: OTHER_USER_EMAIL });
      await holdPosition(portfolio.id, PETR4, PETR4_POSITION);
      await createInstrument({ ...BENCHMARK, ownerId: other.id });
      historyFrom(t, new FakeMarketDataProvider({}));

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        benchmark: BENCHMARK.symbol
      });

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, InstrumentMessages.NOT_FOUND);
    });

    it('describes a portfolio without transactions as an empty window', async () => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id, { baseCurrency: 'EUR' });

      const res = await requestPerformance(accessToken, {
        portfolioId: portfolio.id,
        range: 'MAX'
      });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        baseCurrency: 'EUR',
        from: startOfToday.toISOString(),
        to: startOfToday.toISOString(),
        series: []
      });
    });

    it("answers another user's portfolio exactly like one that does not exist", async () => {
      const holder = await createUser();
      const foreignPortfolio = await createPortfolio(holder.id);
      await holdPosition(foreignPortfolio.id, PETR4, PETR4_POSITION);
      const { accessToken } = await signInUser(OTHER_USER_EMAIL);

      const foreign = await requestPerformance(accessToken, {
        portfolioId: foreignPortfolio.id
      });
      const missing = await requestPerformance(accessToken, {
        portfolioId: MISSING_PORTFOLIO_ID
      });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, PortfolioMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a missing or malformed portfolio id, range, benchmark or symbol', async () => {
      const { accessToken } = await signInUser();

      for (const query of [
        {},
        { portfolioId: 'not-a-uuid' },
        { portfolioId: MISSING_PORTFOLIO_ID, range: '2M' },
        { portfolioId: MISSING_PORTFOLIO_ID, range: '' },
        { portfolioId: MISSING_PORTFOLIO_ID, benchmark: '' },
        { portfolioId: MISSING_PORTFOLIO_ID, symbol: ' ' }
      ]) {
        const res = await requestPerformance(accessToken, query);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(query)
        );
      }
    });
  });

  describe('indicators', () => {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const closedOn = (daysBefore: number) =>
      new Date(startOfToday.getTime() - daysBefore * DAY_MS);

    /** Before the one-year window, which is at most 366 days long, and within the two weeks read before it. */
    const OPENING_DAYS_BEFORE = 370;

    const requestIndicators = (
      accessToken: string,
      symbol: string,
      portfolioId?: string
    ) =>
      client
        .get(positionIndicatorsRoute(symbol))
        .query({ portfolioId })
        .set(bearer(accessToken));

    const holdTradedPosition = async (portfolioId: string) => {
      await createInstrument(PETR4);
      const asset = await createAsset({
        portfolioId,
        symbol: PETR4.symbol,
        quantity: '80',
        averageCost: '40',
        investedValue: '3200'
      });
      await createTransaction(asset, { quantity: '100', unitPrice: '40' });
      await createTransaction(asset, {
        type: 'SELL',
        quantity: '20',
        unitPrice: '55',
        executedAt: closedOn(20)
      });
      await createTransaction(asset, {
        type: 'DIVIDEND',
        quantity: '80',
        unitPrice: '0.5',
        executedAt: closedOn(10)
      });
    };

    it('ranges the last year of closes, lists them from the one that opens the year and returns what the ledger realized and paid', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await holdTradedPosition(portfolio.id);
      historyFrom(
        t,
        new FakeMarketDataProvider({
          PETR4: [
            {
              price: '40',
              currency: 'BRL',
              timestamp: closedOn(OPENING_DAYS_BEFORE)
            },
            { price: '50', currency: 'BRL', timestamp: closedOn(2) },
            { price: '55', currency: 'BRL', timestamp: closedOn(1) }
          ]
        })
      );

      const res = await requestIndicators(accessToken, 'petr4', portfolio.id);

      assert.equal(res.status, 200);

      const { changes, closes, ...prices } = res.body.prices;
      const openedOn = closedOn(OPENING_DAYS_BEFORE).toISOString();

      assert.deepEqual(prices, {
        currency: 'BRL',
        close: '55',
        closedOn: closedOn(1).toISOString(),
        yearLow: '50',
        yearHigh: '55'
      });
      assert.deepEqual(
        changes.filter(({ range }: { range: string }) => range !== 'YTD'),
        [
          { range: '1M', change: '0.375', openedOn },
          { range: '3M', change: '0.375', openedOn },
          { range: '6M', change: '0.375', openedOn },
          { range: '1Y', change: '0.375', openedOn }
        ]
      );
      assert.deepEqual(closes, [
        { close: '40', closedOn: openedOn },
        { close: '50', closedOn: closedOn(2).toISOString() },
        { close: '55', closedOn: closedOn(1).toISOString() }
      ]);
      assert.deepEqual(res.body.returns, {
        currency: 'BRL',
        since: FIXTURE_EXECUTED_AT.toISOString(),
        realizedProfitLoss: '300',
        income: '40',
        trailingIncome: '40',
        yieldOnCost: '0.0125'
      });
    });

    it('answers a position without transactions or closes with no indicators', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      await createInstrument(PETR4);
      await createAsset({ portfolioId: portfolio.id, symbol: PETR4.symbol });
      historyFrom(t, new FakeMarketDataProvider({}));

      const res = await requestIndicators(accessToken, 'PETR4', portfolio.id);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {});
    });

    it('answers 404 for a symbol the portfolio does not hold, without reading its history', async (t) => {
      const { user, accessToken } = await signInUser();
      const portfolio = await createPortfolio(user.id);
      const { getHistoricalPrices } = historyFrom(
        t,
        new FakeMarketDataProvider({})
      );

      const res = await requestIndicators(accessToken, 'PETR4', portfolio.id);

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, AssetMessages.NOT_FOUND);
      assert.equal(getHistoricalPrices.mock.callCount(), 0);
    });

    it("answers 404 for another user's portfolio and 400 for an invalid query", async () => {
      const { accessToken } = await signInUser();
      const other = await createUser({ email: OTHER_USER_EMAIL });
      const foreign = await createPortfolio(other.id);
      await holdTradedPosition(foreign.id);

      const foreignRes = await requestIndicators(
        accessToken,
        'PETR4',
        foreign.id
      );
      const invalidRes = await requestIndicators(accessToken, 'PETR4');

      assert.equal(foreignRes.status, Errors.NOT_FOUND.status);
      assert.equal(foreignRes.body.message, PortfolioMessages.NOT_FOUND);
      assert.equal(invalidRes.status, Errors.VALIDATION.status);
    });
  });
});
