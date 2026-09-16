import assert from 'node:assert/strict';
import { before, describe, it, type TestContext } from 'node:test';

import {
  Errors,
  InstrumentMessages,
  InstrumentTypes,
  PortfolioMessages
} from '@/config';
import type { Instrument, Position } from '@/domain/models';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { YahooFinanceProvider } from '@/infra/market-data';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import { FakeMarketDataProvider } from '@/test/FakeMarketDataProvider';
import {
  FIXTURE_PASSWORD,
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
const PORTFOLIOS_ROUTE = '/v1/portfolios';

/** Mirror `CreatePortfolioSchema`, `PaginationQuerySchema`, `PageQuerySchema` and the default page size in `PortfolioRepository.getAll`. */
const NAME_MAX_LENGTH = 60;
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

const OTHER_USER_EMAIL = 'other@ex3.app';

/** Well-formed, and naming no portfolio: the baseline a foreign portfolio id must be indistinguishable from. */
const MISSING_PORTFOLIO_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Portfolios created one day apart, so the listing order by creation is total
 * and does not depend on the resolution of the database clock.
 */
const FIRST_CREATION_EPOCH_MS = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

const HELD_PORTFOLIO_NAMES = ['First', 'Second', 'Third'];

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

  const signInUser = async (email?: string) => {
    const user = await createUser(email === undefined ? {} : { email });
    const accessToken = await signIn({
      email: user.email,
      password: FIXTURE_PASSWORD
    });

    return { user, accessToken };
  };

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
          Errors.BAD_REQUEST.status,
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

        assert.equal(res.status, Errors.BAD_REQUEST.status, `${limit}`);
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

        assert.equal(res.status, Errors.BAD_REQUEST.status, `${portfolioId}`);
      }
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

        assert.equal(res.status, Errors.BAD_REQUEST.status, `${portfolioId}`);
      }
    });
  });

  describe('positions', () => {
    const NAMED_PETR4 = { ...PETR4, name: 'Petrobras' };
    const AAPL = {
      symbol: 'AAPL',
      name: 'Apple',
      market: 'NASDAQ',
      currency: 'USD'
    };
    const OIBR3 = {
      symbol: 'OIBR3',
      name: 'Oi',
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

    it('rejects a missing or malformed portfolio id, page or page size', async () => {
      const { accessToken } = await signInUser();

      for (const query of [
        {},
        { portfolioId: 'not-a-uuid' },
        { portfolioId: MISSING_PORTFOLIO_ID, page: 0 },
        { portfolioId: MISSING_PORTFOLIO_ID, page: 1.5 },
        { portfolioId: MISSING_PORTFOLIO_ID, pageSize: 0 },
        { portfolioId: MISSING_PORTFOLIO_ID, pageSize: MAX_PAGE_LIMIT + 1 }
      ]) {
        const res = await requestPositions(accessToken, query);

        assert.equal(
          res.status,
          Errors.BAD_REQUEST.status,
          JSON.stringify(query)
        );
      }
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

        assert.equal(res.status, Errors.BAD_REQUEST.status, `${portfolioId}`);
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

    it('rejects a missing or malformed portfolio id, range or benchmark', async () => {
      const { accessToken } = await signInUser();

      for (const query of [
        {},
        { portfolioId: 'not-a-uuid' },
        { portfolioId: MISSING_PORTFOLIO_ID, range: '2M' },
        { portfolioId: MISSING_PORTFOLIO_ID, range: '' },
        { portfolioId: MISSING_PORTFOLIO_ID, benchmark: '' }
      ]) {
        const res = await requestPerformance(accessToken, query);

        assert.equal(
          res.status,
          Errors.BAD_REQUEST.status,
          JSON.stringify(query)
        );
      }
    });
  });
});
