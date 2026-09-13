import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  AssetMessages,
  Errors,
  InstrumentMessages,
  PortfolioMessages
} from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
  FIXTURE_ASSET_SYMBOL,
  FIXTURE_PASSWORD,
  createAsset,
  createInstrument,
  createPortfolio,
  createTransaction,
  createUser,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { injectWriteFailure } from '@/test/TestDatabase';

const ASSETS_ROUTE = '/v1/assets';
const CREATE_ASSET_ROUTE = '/v1/asset';

const assetRoute = (symbol: string) => `/v1/asset/${symbol}`;

/**
 * Mirror `AssetSymbolSchema`, `PaginationQuerySchema` and the default page
 * size in `AssetRepository.getAll`.
 */
const SYMBOL_MAX_LENGTH = 6;
const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

const OTHER_USER_EMAIL = 'other@ex3.app';
const UNHELD_SYMBOL = 'ETH';

/** Outside the letters-and-digits allowlist, as a symbol stored before it existed. */
const LEGACY_SYMBOL = 'BRK.B';

/**
 * Distinct balances give `sort` a total order, so paged results are
 * deterministic; without `sort` the API applies no ordering at all.
 */
const BALANCE_STEP = 100;

const prismaClient = PrismaClient.getInstance();

const heldSymbol = (index: number) => `A${index}`;

const heldSymbols = (count: number) =>
  Array.from({ length: count }, (_, index) => heldSymbol(index));

const holdAssets = (portfolioId: string, count: number) =>
  Promise.all(
    heldSymbols(count).map((symbol, index) =>
      createAsset({
        portfolioId,
        symbol,
        balance: String((index + 1) * BALANCE_STEP)
      })
    )
  );

const symbolsOf = (assets: ReadonlyArray<{ symbol: string }>) =>
  assets.map(({ symbol }) => symbol);

describe('assets', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  const signInWithPortfolio = async (email?: string) => {
    const user = await createUser(email === undefined ? {} : { email });
    const portfolio = await createPortfolio(user.id);
    const accessToken = await signIn({
      email: user.email,
      password: FIXTURE_PASSWORD
    });

    return { portfolio, accessToken };
  };

  const signInSeeded = async () => {
    const seeded = await seedPortfolio();
    const accessToken = await signIn({
      email: seeded.user.email,
      password: FIXTURE_PASSWORD
    });

    return { ...seeded, accessToken };
  };

  describe('add', () => {
    it('opens an empty position in the caller portfolio', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();
      const instrument = await createInstrument({ symbol: UNHELD_SYMBOL });

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({
          symbol: UNHELD_SYMBOL.toLowerCase(),
          portfolioId: portfolio.id
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, AssetMessages.CREATED);
      assert.equal(res.body.asset.symbol, UNHELD_SYMBOL);
      assert.equal(res.body.asset.quantity, '0');
      assert.equal(res.body.asset.averageCost, '0');
      assert.equal(res.body.asset.balance, '0');
      assert.equal(res.body.asset.portfolioId, portfolio.id);
      assert.equal(res.body.asset.instrumentId, instrument.id);
    });

    it('accepts a symbol of exactly the maximum length', async () => {
      const symbol = 'A'.repeat(SYMBOL_MAX_LENGTH);
      const { portfolio, accessToken } = await signInWithPortfolio();
      await createInstrument({ symbol });

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({ symbol, portfolioId: portfolio.id });

      assert.equal(res.status, 201);
    });

    it('rejects an empty symbol and one past the maximum length', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      for (const symbol of ['', 'A'.repeat(SYMBOL_MAX_LENGTH + 1)]) {
        const res = await client
          .post(CREATE_ASSET_ROUTE)
          .set(bearer(accessToken))
          .send({ symbol, portfolioId: portfolio.id });

        assert.equal(res.status, Errors.BAD_REQUEST.status, symbol);
      }

      assert.equal(await prismaClient.position.count(), 0);
    });

    it('rejects a symbol the portfolio already holds, regardless of case', async () => {
      const { portfolio, accessToken } = await signInSeeded();

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({
          symbol: FIXTURE_ASSET_SYMBOL.toLowerCase(),
          portfolioId: portfolio.id
        });

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.message, AssetMessages.ALREADY_EXISTS);
    });

    it('rejects a blank symbol', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({
          symbol: ' '.repeat(SYMBOL_MAX_LENGTH),
          portfolioId: portfolio.id
        });

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it('rejects a symbol with characters other than letters and digits', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      for (const symbol of [LEGACY_SYMBOL, 'B$', '<b>', 'ÉTH']) {
        const res = await client
          .post(CREATE_ASSET_ROUTE)
          .set(bearer(accessToken))
          .send({ symbol, portfolioId: portfolio.id });

        assert.equal(res.status, Errors.BAD_REQUEST.status, symbol);
      }

      assert.equal(await prismaClient.position.count(), 0);
    });

    it('lets two portfolios hold the one instrument of a symbol', async () => {
      const holder = await seedPortfolio();
      const { portfolio, accessToken } =
        await signInWithPortfolio(OTHER_USER_EMAIL);

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({ symbol: FIXTURE_ASSET_SYMBOL, portfolioId: portfolio.id });

      assert.equal(res.status, 201);
      assert.equal(res.body.asset.instrumentId, holder.asset.instrumentId);
      assert.equal(await prismaClient.instrument.count(), 1);
    });

    it('answers not found for a symbol outside the catalog and opens nothing', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({ symbol: UNHELD_SYMBOL, portfolioId: portfolio.id });

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, InstrumentMessages.NOT_FOUND);
      assert.equal(await prismaClient.position.count(), 0);
    });
  });

  describe('get', () => {
    it('returns a held asset, matching the symbol case-insensitively', async () => {
      const { portfolio, asset, accessToken } = await signInSeeded();

      const res = await client
        .get(assetRoute(asset.symbol.toLowerCase()))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.id, asset.id);
      assert.equal(res.body.symbol, asset.symbol);
      assert.equal(res.body.quantity, asset.quantity.toFixed());
      assert.equal(res.body.averageCost, asset.averageCost.toFixed());
      assert.equal(res.body.balance, asset.balance.toFixed());
    });

    it('answers not found for a symbol the portfolio does not hold', async () => {
      const { portfolio, accessToken } = await signInSeeded();

      const res = await client
        .get(assetRoute(UNHELD_SYMBOL))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, AssetMessages.NOT_FOUND);
    });

    it("answers another user's asset exactly like one that does not exist", async () => {
      await seedPortfolio();
      const { portfolio, accessToken } =
        await signInWithPortfolio(OTHER_USER_EMAIL);

      const foreign = await client
        .get(assetRoute(FIXTURE_ASSET_SYMBOL))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));
      const missing = await client
        .get(assetRoute(UNHELD_SYMBOL))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('rejects a symbol past the maximum length', async () => {
      const { portfolio, accessToken } = await signInSeeded();

      const res = await client
        .get(assetRoute('A'.repeat(SYMBOL_MAX_LENGTH + 1)))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.BAD_REQUEST.status);
    });

    it('still reads a stored symbol outside the allowlist for new symbols', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();
      await createAsset({ portfolioId: portfolio.id, symbol: LEGACY_SYMBOL });

      const res = await client
        .get(assetRoute(LEGACY_SYMBOL.toLowerCase()))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.symbol, LEGACY_SYMBOL);
    });
  });

  describe('list', () => {
    it('lists only the caller portfolio', async () => {
      await seedPortfolio();
      const { portfolio, accessToken } =
        await signInWithPortfolio(OTHER_USER_EMAIL);
      await createAsset({ portfolioId: portfolio.id, symbol: UNHELD_SYMBOL });

      const res = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(symbolsOf(res.body.assets), [UNHELD_SYMBOL]);
      assert.equal(res.body.pagination.total, 1);
      assert.equal(res.body.sort, undefined);
    });

    it('describes an empty portfolio', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const res = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        pagination: {
          page: 1,
          limit: DEFAULT_PAGE_LIMIT,
          total: 0,
          totalPages: 0
        },
        assets: []
      });
    });
  });

  describe('pagination', () => {
    it('defaults to the first page of the default size', async () => {
      const heldCount = DEFAULT_PAGE_LIMIT + 1;
      const { portfolio, accessToken } = await signInWithPortfolio();
      await holdAssets(portfolio.id, heldCount);

      const res = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.assets.length, DEFAULT_PAGE_LIMIT);
      assert.deepEqual(res.body.pagination, {
        page: 1,
        limit: DEFAULT_PAGE_LIMIT,
        total: heldCount,
        totalPages: 2
      });
    });

    it('splits the portfolio into disjoint pages that cover all of it, the last one partial', async () => {
      const heldCount = 5;
      const limit = 2;
      const totalPages = Math.ceil(heldCount / limit);
      const { portfolio, accessToken } = await signInWithPortfolio();
      await holdAssets(portfolio.id, heldCount);

      const pagedSymbols = [];

      for (let page = 1; page <= totalPages; page += 1) {
        const res = await client
          .get(ASSETS_ROUTE)
          .query({ portfolioId: portfolio.id, page, limit, sort: 'asc' })
          .set(bearer(accessToken));

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.pagination, {
          page,
          limit,
          total: heldCount,
          totalPages
        });
        pagedSymbols.push(symbolsOf(res.body.assets));
      }

      assert.deepEqual(pagedSymbols, [
        [heldSymbol(0), heldSymbol(1)],
        [heldSymbol(2), heldSymbol(3)],
        [heldSymbol(4)]
      ]);
    });

    it('returns no assets past the last page', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();
      await holdAssets(portfolio.id, DEFAULT_PAGE_LIMIT);

      const res = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, page: 2 })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.assets, []);
      assert.equal(res.body.pagination.page, 2);
      assert.equal(res.body.pagination.totalPages, 1);
    });

    it('rejects a page or limit that is not a positive number', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      for (const query of [
        { page: 0 },
        { page: -1 },
        { page: 'first' },
        { limit: 0 }
      ]) {
        const res = await client
          .get(ASSETS_ROUTE)
          .query({ ...query, portfolioId: portfolio.id })
          .set(bearer(accessToken));

        assert.equal(
          res.status,
          Errors.BAD_REQUEST.status,
          JSON.stringify(query)
        );
      }
    });

    it('rejects a fractional page or limit', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      for (const query of [{ page: 1.5 }, { limit: 2.5 }]) {
        const res = await client
          .get(ASSETS_ROUTE)
          .query({ ...query, portfolioId: portfolio.id })
          .set(bearer(accessToken));

        assert.equal(
          res.status,
          Errors.BAD_REQUEST.status,
          JSON.stringify(query)
        );
      }
    });

    it('bounds the page size', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const atBound = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, limit: MAX_PAGE_LIMIT })
        .set(bearer(accessToken));
      const pastBound = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, limit: MAX_PAGE_LIMIT + 1 })
        .set(bearer(accessToken));

      assert.equal(atBound.status, 200);
      assert.equal(atBound.body.pagination.limit, MAX_PAGE_LIMIT);
      assert.equal(pastBound.status, Errors.BAD_REQUEST.status);
    });
  });

  describe('sort', () => {
    it('orders by balance in either direction, case-insensitively', async () => {
      const heldCount = 3;
      const { portfolio, accessToken } = await signInWithPortfolio();
      await holdAssets(portfolio.id, heldCount);

      const ascending = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, sort: 'asc' })
        .set(bearer(accessToken));
      const descending = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, sort: 'DESC' })
        .set(bearer(accessToken));

      assert.deepEqual(
        symbolsOf(ascending.body.assets),
        heldSymbols(heldCount)
      );
      assert.deepEqual(ascending.body.sort, { field: 'balance', order: 'asc' });
      assert.deepEqual(
        symbolsOf(descending.body.assets),
        heldSymbols(heldCount).reverse()
      );
      assert.deepEqual(descending.body.sort, {
        field: 'balance',
        order: 'desc'
      });
    });

    it('rejects an unknown sort order', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      const res = await client
        .get(ASSETS_ROUTE)
        .query({ portfolioId: portfolio.id, sort: 'up' })
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.BAD_REQUEST.status);
    });
  });

  /**
   * The API has no search. The web filters the page it already fetched by
   * symbol substring (`assets-table.tsx`), so it never finds a match on another
   * page (baseline #25, TASK 9.1). That filter relies on the listing not being
   * narrowed by anything in the query besides paging and sorting.
   */
  describe('search', () => {
    it('does not narrow the listing by a symbol in the query', async () => {
      const heldCount = 3;
      const { portfolio, accessToken } = await signInWithPortfolio();
      await holdAssets(portfolio.id, heldCount);

      const res = await client
        .get(ASSETS_ROUTE)
        .query({
          portfolioId: portfolio.id,
          symbol: heldSymbol(0),
          search: heldSymbol(0),
          sort: 'asc'
        })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(symbolsOf(res.body.assets), heldSymbols(heldCount));
    });
  });

  describe('rename', () => {
    const RENAMED_SYMBOL = 'XBT';

    const renameAsset = (
      {
        accessToken,
        portfolio
      }: Awaited<ReturnType<typeof signInWithPortfolio>>,
      from: string,
      to: string
    ) =>
      client
        .patch(assetRoute(from))
        .set(bearer(accessToken))
        .send({ newSymbol: to, portfolioId: portfolio.id });

    const storedSymbolOf = async (id: string) => {
      const { instrument } = await prismaClient.position.findUniqueOrThrow({
        where: { id },
        select: { instrument: { select: { symbol: true } } }
      });

      return instrument.symbol;
    };

    it('renames a held asset, matching the old symbol case-insensitively', async () => {
      const caller = await signInWithPortfolio();
      const asset = await createAsset({ portfolioId: caller.portfolio.id });
      await createInstrument({ symbol: UNHELD_SYMBOL });

      const res = await renameAsset(
        caller,
        asset.symbol.toLowerCase(),
        UNHELD_SYMBOL.toLowerCase()
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.message, AssetMessages.UPDATED);
      assert.equal(await storedSymbolOf(asset.id), UNHELD_SYMBOL);
    });

    it('carries the transactions of the renamed asset along', async () => {
      const caller = await signInSeeded();
      const { portfolio, asset, transaction, accessToken } = caller;
      await createInstrument({ symbol: RENAMED_SYMBOL });

      const res = await renameAsset(caller, asset.symbol, RENAMED_SYMBOL);
      const listed = await client
        .get(`/v1/transactions/${RENAMED_SYMBOL}`)
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.transactions.map(({ id }: { id: string }) => id),
        [transaction.id]
      );
      assert.equal(
        await prismaClient.transaction.count({
          where: { instrumentId: asset.instrumentId }
        }),
        0
      );
    });

    it('renames a stored symbol outside the allowlist for new symbols', async () => {
      const caller = await signInWithPortfolio();
      await createAsset({
        portfolioId: caller.portfolio.id,
        symbol: LEGACY_SYMBOL
      });
      await createInstrument({ symbol: UNHELD_SYMBOL });

      const res = await renameAsset(caller, LEGACY_SYMBOL, UNHELD_SYMBOL);

      assert.equal(res.status, 200);
    });

    it('rejects a new symbol outside the allowlist, keeping the old one', async () => {
      const caller = await signInWithPortfolio();
      const asset = await createAsset({ portfolioId: caller.portfolio.id });

      const res = await renameAsset(caller, asset.symbol, LEGACY_SYMBOL);

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(await storedSymbolOf(asset.id), asset.symbol);
    });

    it("answers another user's asset like a missing one and leaves it untouched", async () => {
      const { portfolio } = await signInWithPortfolio();
      const asset = await createAsset({ portfolioId: portfolio.id });
      const intruder = await signInWithPortfolio(OTHER_USER_EMAIL);

      const foreign = await renameAsset(intruder, asset.symbol, RENAMED_SYMBOL);
      const missing = await renameAsset(
        intruder,
        UNHELD_SYMBOL,
        RENAMED_SYMBOL
      );

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.deepEqual(foreign.body, missing.body);
      assert.equal(await storedSymbolOf(asset.id), asset.symbol);
    });

    it('answers not found for a new symbol outside the catalog, keeping the old one', async () => {
      const caller = await signInWithPortfolio();
      const asset = await createAsset({ portfolioId: caller.portfolio.id });

      const res = await renameAsset(caller, asset.symbol, RENAMED_SYMBOL);

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, InstrumentMessages.NOT_FOUND);
      assert.equal(await storedSymbolOf(asset.id), asset.symbol);
    });

    it('rejects a new symbol the portfolio already holds, keeping both assets and the transactions', async () => {
      const caller = await signInSeeded();
      const { portfolio, asset, transaction } = caller;
      const held = await createAsset({
        portfolioId: portfolio.id,
        symbol: RENAMED_SYMBOL
      });

      for (const newSymbol of [held.symbol, asset.symbol]) {
        const res = await renameAsset(caller, asset.symbol, newSymbol);

        assert.equal(res.status, Errors.BAD_REQUEST.status, newSymbol);
        assert.equal(res.body.message, AssetMessages.ALREADY_EXISTS, newSymbol);
      }

      assert.equal(await storedSymbolOf(asset.id), asset.symbol);
      assert.equal(await storedSymbolOf(held.id), held.symbol);
      assert.deepEqual(
        await prismaClient.transaction.findUniqueOrThrow({
          where: { id: transaction.id }
        }),
        transaction
      );
    });
  });

  describe('delete', () => {
    it('removes the asset and its transactions, keeping the rest', async () => {
      const { portfolio, asset, accessToken } = await signInSeeded();
      const kept = await createAsset({
        portfolioId: portfolio.id,
        symbol: UNHELD_SYMBOL
      });

      const res = await client
        .delete(assetRoute(asset.symbol.toLowerCase()))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(res.body.message, AssetMessages.DELETED);

      const [remaining, transactions] = await Promise.all([
        prismaClient.position.findMany({
          where: { portfolioId: portfolio.id },
          select: { id: true }
        }),
        prismaClient.transaction.count({
          where: { portfolioId: portfolio.id }
        })
      ]);

      assert.deepEqual(remaining, [{ id: kept.id }]);
      assert.equal(transactions, 0);
    });

    it('keeps the asset and transactions another portfolio holds in the same instrument', async () => {
      const holder = await seedPortfolio();
      const { portfolio, accessToken } =
        await signInWithPortfolio(OTHER_USER_EMAIL);
      const asset = await createAsset({
        portfolioId: portfolio.id,
        symbol: holder.asset.symbol
      });
      await createTransaction(asset);

      const res = await client
        .delete(assetRoute(asset.symbol))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(
        await prismaClient.position.findMany({ select: { id: true } }),
        [{ id: holder.asset.id }]
      );
      assert.deepEqual(await prismaClient.transaction.findMany(), [
        holder.transaction
      ]);
    });

    it('answers not found for a symbol the portfolio does not hold', async () => {
      const { portfolio, accessToken } = await signInSeeded();

      const res = await client
        .delete(assetRoute(UNHELD_SYMBOL))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, AssetMessages.NOT_FOUND);
    });

    it("answers another user's asset like a missing one and leaves it and its transactions untouched", async () => {
      const { asset } = await seedPortfolio();
      const { portfolio, accessToken } =
        await signInWithPortfolio(OTHER_USER_EMAIL);

      const foreign = await client
        .delete(assetRoute(asset.symbol))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));
      const missing = await client
        .delete(assetRoute(UNHELD_SYMBOL))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.deepEqual(foreign.body, missing.body);

      const [assets, transactions] = await Promise.all([
        prismaClient.position.count({ where: { id: asset.id } }),
        prismaClient.transaction.count({
          where: { instrumentId: asset.instrumentId }
        })
      ]);

      assert.equal(assets, 1);
      assert.equal(transactions, 1);
    });

    it('keeps the asset and its transactions when removing the position fails', async (t) => {
      const { portfolio, asset, transaction, accessToken } =
        await signInSeeded();
      injectWriteFailure(t, 'position', 'deleteMany');
      t.mock.method(console, 'error', () => undefined);

      const res = await client
        .delete(assetRoute(asset.symbol))
        .query({ portfolioId: portfolio.id })
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.INTERNAL_SERVER_ERROR.status);
      assert.equal(
        await prismaClient.position.count({ where: { id: asset.id } }),
        1
      );
      assert.deepEqual(await prismaClient.transaction.findMany(), [
        transaction
      ]);
    });
  });

  describe('portfolio scope', () => {
    /** Well-formed, and naming no portfolio: the baseline a foreign portfolio id must be indistinguishable from. */
    const MISSING_PORTFOLIO_ID = '00000000-0000-4000-8000-000000000000';

    const scopedRequests = {
      'POST asset': (accessToken: string, portfolioId?: string) =>
        client
          .post(CREATE_ASSET_ROUTE)
          .set(bearer(accessToken))
          .send({ symbol: UNHELD_SYMBOL, portfolioId }),
      'GET assets': (accessToken: string, portfolioId?: string) =>
        client
          .get(ASSETS_ROUTE)
          .query({ portfolioId })
          .set(bearer(accessToken)),
      'GET asset': (accessToken: string, portfolioId?: string) =>
        client
          .get(assetRoute(FIXTURE_ASSET_SYMBOL))
          .query({ portfolioId })
          .set(bearer(accessToken)),
      'PATCH asset': (accessToken: string, portfolioId?: string) =>
        client
          .patch(assetRoute(FIXTURE_ASSET_SYMBOL))
          .set(bearer(accessToken))
          .send({ newSymbol: UNHELD_SYMBOL, portfolioId }),
      'DELETE asset': (accessToken: string, portfolioId?: string) =>
        client
          .delete(assetRoute(FIXTURE_ASSET_SYMBOL))
          .query({ portfolioId })
          .set(bearer(accessToken))
    };

    const storedAssets = () =>
      prismaClient.position.findMany({
        select: {
          id: true,
          instrumentId: true,
          quantity: true,
          averageCost: true,
          balance: true
        }
      });

    it("answers another user's portfolio exactly like one that does not exist and changes nothing", async () => {
      const holder = await seedPortfolio();
      await createInstrument({ symbol: UNHELD_SYMBOL });
      const { accessToken } = await signInWithPortfolio(OTHER_USER_EMAIL);

      for (const [request, send] of Object.entries(scopedRequests)) {
        const foreign = await send(accessToken, holder.portfolio.id);
        const missing = await send(accessToken, MISSING_PORTFOLIO_ID);

        assert.equal(foreign.status, Errors.NOT_FOUND.status, request);
        assert.equal(
          foreign.body.message,
          PortfolioMessages.NOT_FOUND,
          request
        );
        assert.deepEqual(foreign.body, missing.body, request);
      }

      const { id, instrumentId, quantity, averageCost, balance } = holder.asset;

      assert.deepEqual(await storedAssets(), [
        { id, instrumentId, quantity, averageCost, balance }
      ]);
      assert.deepEqual(await prismaClient.transaction.findMany(), [
        holder.transaction
      ]);
    });

    it('rejects a request without a well-formed portfolio id and changes nothing', async () => {
      const { asset, accessToken } = await signInSeeded();
      await createInstrument({ symbol: UNHELD_SYMBOL });

      for (const [request, send] of Object.entries(scopedRequests)) {
        for (const portfolioId of [undefined, 'not-a-uuid']) {
          const res = await send(accessToken, portfolioId);

          assert.equal(
            res.status,
            Errors.BAD_REQUEST.status,
            `${request} ${portfolioId}`
          );
        }
      }

      const { id, instrumentId, quantity, averageCost, balance } = asset;

      assert.deepEqual(await storedAssets(), [
        { id, instrumentId, quantity, averageCost, balance }
      ]);
      assert.equal(await prismaClient.transaction.count(), 1);
    });

    it('keeps apart the positions two portfolios of one caller hold in the same instrument', async () => {
      const { user, portfolio, asset, accessToken } = await signInSeeded();
      const secondPortfolio = await createPortfolio(user.id);

      const opened = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({ symbol: asset.symbol, portfolioId: secondPortfolio.id });
      const listedIds = async (portfolioId: string) => {
        const res = await client
          .get(ASSETS_ROUTE)
          .query({ portfolioId })
          .set(bearer(accessToken));

        return res.body.assets.map(({ id }: { id: string }) => id);
      };

      assert.equal(opened.status, 201);
      assert.equal(opened.body.asset.instrumentId, asset.instrumentId);
      assert.deepEqual(await listedIds(portfolio.id), [asset.id]);
      assert.deepEqual(await listedIds(secondPortfolio.id), [
        opened.body.asset.id
      ]);

      const deleted = await client
        .delete(assetRoute(asset.symbol))
        .query({ portfolioId: secondPortfolio.id })
        .set(bearer(accessToken));

      assert.equal(deleted.status, 200);
      assert.deepEqual(
        await prismaClient.position.findMany({ select: { id: true } }),
        [{ id: asset.id }]
      );
      assert.equal(await prismaClient.transaction.count(), 1);
    });
  });
});
