import assert from 'node:assert/strict';
import { before, describe, it, type TestContext } from 'node:test';

import {
  AssetMessages,
  Errors,
  InstrumentMessages,
  MarketDataMessages,
  PortfolioMessages
} from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { YahooFinanceProvider } from '@/infra/market-data';
import {
  apiRequest,
  bearer,
  signInSeeded,
  signInWithPortfolio
} from '@/test/ApiClient';
import { FakeMarketDataProvider } from '@/test/FakeMarketDataProvider';
import {
  FIXTURE_ASSET_SYMBOL,
  MISSING_UUID,
  createAsset,
  createInstrument,
  createPortfolio,
  createTransaction,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { injectWriteFailure } from '@/test/TestDatabase';

const CREATE_ASSET_ROUTE = '/v1/asset';

const assetRoute = (symbol: string) => `/v1/asset/${symbol}`;

/** Mirrors `AssetSymbolSchema`. */
const SYMBOL_MAX_LENGTH = 6;

const OTHER_USER_EMAIL = 'other@ex3.app';
const UNHELD_SYMBOL = 'ETH';

/** Outside the letters-and-digits allowlist, as a symbol stored before it existed. */
const LEGACY_SYMBOL = 'BRK.B';

const prismaClient = PrismaClient.getInstance();

describe('assets', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

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
      assert.equal(res.body.asset.investedValue, '0');
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

        assert.equal(res.status, Errors.VALIDATION.status, symbol);
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

      assert.equal(res.status, Errors.CONFLICT.status);
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

      assert.equal(res.status, Errors.VALIDATION.status);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it('rejects a symbol with characters other than letters and digits', async () => {
      const { portfolio, accessToken } = await signInWithPortfolio();

      for (const symbol of [LEGACY_SYMBOL, 'B$', '<b>', 'ÉTH']) {
        const res = await client
          .post(CREATE_ASSET_ROUTE)
          .set(bearer(accessToken))
          .send({ symbol, portfolioId: portfolio.id });

        assert.equal(res.status, Errors.VALIDATION.status, symbol);
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

  describe('add from a market listing', () => {
    const LISTED_SYMBOL = 'XPML11';

    const XPML11_LISTING = {
      symbol: LISTED_SYMBOL,
      name: 'XP Malls Fundo de Investimento Imobiliário',
      type: 'REIT',
      market: 'B3',
      currency: 'BRL',
      sector: 'Real Estate'
    } as const;

    const XPML11_REFERENCE = { market: 'B3', currency: 'BRL' };

    const listFrom = (
      t: TestContext,
      provider: FakeMarketDataProvider = new FakeMarketDataProvider(
        {},
        { listings: [XPML11_LISTING] }
      )
    ) =>
      t.mock.method(
        YahooFinanceProvider.getInstance(),
        'describeListing',
        (...args: Parameters<YahooFinanceProvider['describeListing']>) =>
          provider.describeListing(...args)
      );

    const registerAsset = (
      {
        accessToken,
        portfolio
      }: Awaited<ReturnType<typeof signInWithPortfolio>>,
      symbol: string,
      listing: Record<string, unknown> = XPML11_REFERENCE
    ) =>
      client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(accessToken))
        .send({ symbol, portfolioId: portfolio.id, listing });

    it('registers the listed instrument for the caller alone, as the provider describes it, and opens the position in one step', async (t) => {
      const describeListing = listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await registerAsset(caller, LISTED_SYMBOL.toLowerCase(), {
        market: 'b3',
        currency: 'brl'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, AssetMessages.CREATED);
      assert.equal(res.body.asset.symbol, LISTED_SYMBOL);
      assert.equal(res.body.asset.portfolioId, caller.portfolio.id);
      assert.deepEqual(describeListing.mock.calls[0].arguments, [
        { symbol: LISTED_SYMBOL, market: 'B3', currency: 'BRL' }
      ]);
      assert.deepEqual(
        await prismaClient.instrument.findUniqueOrThrow({
          where: { id: res.body.asset.instrumentId },
          select: {
            symbol: true,
            name: true,
            type: true,
            market: true,
            currency: true,
            sector: true,
            ownerId: true
          }
        }),
        { ...XPML11_LISTING, ownerId: caller.user.id }
      );
    });

    it('takes no attribute of the instrument from the request', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(caller.accessToken))
        .send({
          symbol: LISTED_SYMBOL,
          portfolioId: caller.portfolio.id,
          listing: { ...XPML11_REFERENCE, name: 'Forged', type: 'CASH' },
          instrument: { name: 'Forged', type: 'CASH' }
        });

      assert.equal(res.status, 201);
      assert.deepEqual(
        await prismaClient.instrument.findUniqueOrThrow({
          where: { id: res.body.asset.instrumentId },
          select: { name: true, type: true }
        }),
        { name: XPML11_LISTING.name, type: XPML11_LISTING.type }
      );
    });

    it('stores no sector when the provider lists none', async (t) => {
      const { sector: _sector, ...unsectored } = XPML11_LISTING;
      listFrom(t, new FakeMarketDataProvider({}, { listings: [unsectored] }));
      const caller = await signInWithPortfolio();

      const res = await registerAsset(caller, LISTED_SYMBOL);

      assert.equal(res.status, 201);
      assert.equal(
        (
          await prismaClient.instrument.findUniqueOrThrow({
            where: { id: res.body.asset.instrumentId }
          })
        ).sector,
        null
      );
    });

    it('refuses a symbol the catalog holds without asking the provider, pointing to the catalog instrument instead of duplicating it', async (t) => {
      const describeListing = listFrom(t);
      const caller = await signInWithPortfolio();
      await createInstrument({ symbol: LISTED_SYMBOL });

      const res = await registerAsset(caller, LISTED_SYMBOL);

      assert.equal(res.status, Errors.CONFLICT.status);
      assert.equal(res.body.message, InstrumentMessages.ALREADY_EXISTS);
      assert.equal(describeListing.mock.callCount(), 0);
      assert.equal(await prismaClient.instrument.count(), 1);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it('refuses a symbol the caller already registered, even from another portfolio', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const otherPortfolio = await createPortfolio(caller.user.id, {
        name: 'Other'
      });

      const first = await registerAsset(caller, LISTED_SYMBOL);
      const again = await registerAsset(
        { ...caller, portfolio: otherPortfolio },
        LISTED_SYMBOL
      );

      assert.equal(first.status, 201);
      assert.equal(again.status, Errors.CONFLICT.status);
      assert.equal(
        again.body.message,
        InstrumentMessages.PRIVATE_ALREADY_EXISTS
      );
      assert.equal(await prismaClient.instrument.count(), 1);
      assert.equal(await prismaClient.position.count(), 1);
    });

    it('lets the caller add a registered instrument to another portfolio by symbol', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const otherPortfolio = await createPortfolio(caller.user.id, {
        name: 'Other'
      });

      const registered = await registerAsset(caller, LISTED_SYMBOL);
      const added = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(caller.accessToken))
        .send({ symbol: LISTED_SYMBOL, portfolioId: otherPortfolio.id });

      assert.equal(added.status, 201);
      assert.equal(
        added.body.asset.instrumentId,
        registered.body.asset.instrumentId
      );
    });

    it('keeps the instruments two users register apart, even under one symbol', async (t) => {
      listFrom(t);
      const owner = await signInWithPortfolio();
      const other = await signInWithPortfolio(OTHER_USER_EMAIL);

      const owned = await registerAsset(owner, LISTED_SYMBOL);
      const foreignPick = await client
        .post(CREATE_ASSET_ROUTE)
        .set(bearer(other.accessToken))
        .send({ symbol: LISTED_SYMBOL, portfolioId: other.portfolio.id });
      const ownRegistration = await registerAsset(other, LISTED_SYMBOL);

      assert.equal(foreignPick.status, Errors.NOT_FOUND.status);
      assert.equal(foreignPick.body.message, InstrumentMessages.NOT_FOUND);
      assert.equal(ownRegistration.status, 201);
      assert.notEqual(
        ownRegistration.body.asset.instrumentId,
        owned.body.asset.instrumentId
      );
    });

    it('refuses a currency the market does not quote in without asking the provider and registers nothing', async (t) => {
      const describeListing = listFrom(t);
      const caller = await signInWithPortfolio();

      const res = await registerAsset(caller, LISTED_SYMBOL, {
        ...XPML11_REFERENCE,
        currency: 'USD'
      });

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal(res.body.message, InstrumentMessages.CURRENCY_MISMATCH);
      assert.equal(describeListing.mock.callCount(), 0);
      assert.equal(await prismaClient.instrument.count(), 0);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it('answers not found for what the provider does not list in that market and registers nothing', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();

      const unlisted = await registerAsset(caller, 'XPML12');
      const otherMarket = await registerAsset(caller, LISTED_SYMBOL, {
        market: 'CRYPTO',
        currency: 'BRL'
      });

      for (const res of [unlisted, otherMarket]) {
        assert.equal(res.status, Errors.NOT_FOUND.status);
        assert.equal(res.body.message, InstrumentMessages.NOT_LISTED);
      }
      assert.equal(await prismaClient.instrument.count(), 0);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it('answers unavailable while the provider cannot answer and registers nothing', async (t) => {
      listFrom(
        t,
        new FakeMarketDataProvider(
          {},
          { isAvailable: false, listings: [XPML11_LISTING] }
        )
      );
      const caller = await signInWithPortfolio();

      const res = await registerAsset(caller, LISTED_SYMBOL);

      assert.equal(res.status, Errors.UNAVAILABLE.status);
      assert.equal(res.body.code, Errors.UNAVAILABLE.code);
      assert.equal(res.body.message, MarketDataMessages.UNAVAILABLE);
      assert.equal(await prismaClient.instrument.count(), 0);
    });

    it('rejects a listing outside the contract and registers nothing', async (t) => {
      const describeListing = listFrom(t);
      const caller = await signInWithPortfolio();
      const invalidListings = [
        {},
        { ...XPML11_REFERENCE, market: undefined },
        { ...XPML11_REFERENCE, market: 'LSE' },
        { ...XPML11_REFERENCE, currency: undefined },
        { ...XPML11_REFERENCE, currency: 'REAL' }
      ];

      for (const listing of invalidListings) {
        const res = await registerAsset(caller, LISTED_SYMBOL, listing);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(listing)
        );
      }

      const invalidSymbol = await registerAsset(caller, 'XPML.11');

      assert.equal(invalidSymbol.status, Errors.VALIDATION.status);
      assert.equal(describeListing.mock.callCount(), 0);
      assert.equal(await prismaClient.instrument.count(), 0);
      assert.equal(await prismaClient.position.count(), 0);
    });

    it("answers another user's portfolio like a missing one and registers nothing", async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      const other = await signInWithPortfolio(OTHER_USER_EMAIL);

      const res = await registerAsset(
        { ...caller, portfolio: other.portfolio },
        LISTED_SYMBOL
      );

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, PortfolioMessages.NOT_FOUND);
      assert.equal(await prismaClient.instrument.count(), 0);
    });

    it('registers nothing when opening the position fails', async (t) => {
      listFrom(t);
      const caller = await signInWithPortfolio();
      injectWriteFailure(t, 'position', 'create');
      t.mock.method(console, 'error', () => undefined);

      const res = await registerAsset(caller, LISTED_SYMBOL);

      assert.equal(res.status, Errors.INTERNAL.status);
      assert.equal(await prismaClient.instrument.count(), 0);
      assert.equal(await prismaClient.position.count(), 0);
    });
  });

  /**
   * The API has no search. The web filters the page it already fetched by
   * symbol substring (`assets-table.tsx`), so it never finds a match on another
   * page (baseline #25, TASK 9.1). That filter relies on the listing not being
   * narrowed by anything in the query besides paging and sorting.
   */
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
        .get('/v1/transactions')
        .query({ portfolioId: portfolio.id, symbol: RENAMED_SYMBOL })
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.items.map(({ id }: { id: string }) => id),
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

      assert.equal(res.status, Errors.VALIDATION.status);
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

    it("moves the asset to the caller's private instrument, never to another user's", async () => {
      const caller = await signInWithPortfolio();
      const other = await signInWithPortfolio(OTHER_USER_EMAIL);
      const asset = await createAsset({ portfolioId: caller.portfolio.id });
      await createInstrument({
        symbol: RENAMED_SYMBOL,
        ownerId: other.user.id
      });

      const foreign = await renameAsset(caller, asset.symbol, RENAMED_SYMBOL);

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(await storedSymbolOf(asset.id), asset.symbol);

      const owned = await createInstrument({
        symbol: RENAMED_SYMBOL,
        ownerId: caller.user.id
      });

      const moved = await renameAsset(caller, asset.symbol, RENAMED_SYMBOL);

      assert.equal(moved.status, 200);
      assert.equal(
        (
          await prismaClient.position.findUniqueOrThrow({
            where: { id: asset.id }
          })
        ).instrumentId,
        owned.id
      );
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

        assert.equal(res.status, Errors.CONFLICT.status, newSymbol);
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

      assert.equal(res.status, Errors.INTERNAL.status);
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
    const MISSING_PORTFOLIO_ID = MISSING_UUID;

    const scopedRequests = {
      'POST asset': (accessToken: string, portfolioId?: string) =>
        client
          .post(CREATE_ASSET_ROUTE)
          .set(bearer(accessToken))
          .send({ symbol: UNHELD_SYMBOL, portfolioId }),
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
          investedValue: true
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

      const { id, instrumentId, quantity, averageCost, investedValue } =
        holder.asset;

      assert.deepEqual(await storedAssets(), [
        { id, instrumentId, quantity, averageCost, investedValue }
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
            Errors.VALIDATION.status,
            `${request} ${portfolioId}`
          );
        }
      }

      const { id, instrumentId, quantity, averageCost, investedValue } = asset;

      assert.deepEqual(await storedAssets(), [
        { id, instrumentId, quantity, averageCost, investedValue }
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
      const storedIds = async (portfolioId: string) =>
        (
          await prismaClient.position.findMany({
            where: { portfolioId },
            select: { id: true }
          })
        ).map(({ id }) => id);

      assert.equal(opened.status, 201);
      assert.equal(opened.body.asset.instrumentId, asset.instrumentId);
      assert.deepEqual(await storedIds(portfolio.id), [asset.id]);
      assert.deepEqual(await storedIds(secondPortfolio.id), [
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
