import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  Errors,
  InstrumentMessages,
  InstrumentScopes,
  InstrumentTypes,
  MarketQuoteCurrencies
} from '@/config';
import type { User } from '@/domain/models';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
  FIXTURE_PASSWORD,
  createInstrument,
  createUser,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const INSTRUMENTS_ROUTE = '/v1/instruments';
const INSTRUMENT_OPTIONS_ROUTE = '/v1/instruments/options';
const CREATE_INSTRUMENT_ROUTE = '/v1/instrument';
const USER_ROUTE = '/v1/user';

const instrumentRoute = (symbol: string) => `/v1/instrument/${symbol}`;

/** Mirrors `InstrumentAttributesSchema`. */
const NAME_MAX_LENGTH = 120;

const PETR4 = {
  symbol: 'PETR4',
  name: 'Petrobras PN',
  type: InstrumentTypes.STOCK,
  market: 'B3',
  currency: 'BRL',
  sector: 'Energy',
  country: 'BR'
};

const UNLISTED_SYMBOL = 'VALE3';
const OTHER_USER_EMAIL = 'other@ex3.app';

const CATALOG_ATTRIBUTES = {
  symbol: true,
  name: true,
  type: true,
  market: true,
  currency: true,
  sector: true,
  country: true
} as const;

const prismaClient = PrismaClient.getInstance();

const storedInstrument = (symbol: string) =>
  prismaClient.instrument.findFirstOrThrow({
    where: { symbol, ownerId: null },
    select: CATALOG_ATTRIBUTES
  });

describe('instruments', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  const signInAs = async (role: Pick<User, 'isAdmin'>) => {
    const user = await createUser(role);

    return signIn({ email: user.email, password: FIXTURE_PASSWORD });
  };

  const signInWithUser = async (
    role: Pick<User, 'isAdmin'> & Partial<Pick<User, 'email'>>
  ) => {
    const user = await createUser(role);
    const accessToken = await signIn({
      email: user.email,
      password: FIXTURE_PASSWORD
    });

    return { user, accessToken };
  };

  const listInstruments = async (
    accessToken: string,
    query: Record<string, string> = {}
  ) => {
    const res = await client
      .get(INSTRUMENTS_ROUTE)
      .query(query)
      .set(bearer(accessToken));

    assert.equal(res.status, 200);

    return res.body.instruments.map(
      ({
        symbol,
        name,
        scope
      }: Record<'symbol' | 'name' | 'scope', string>) => ({
        symbol,
        name,
        scope
      })
    );
  };

  const registerInstrument = (
    accessToken: string,
    instrument: Record<string, unknown>
  ) =>
    client
      .post(CREATE_INSTRUMENT_ROUTE)
      .set(bearer(accessToken))
      .send(instrument);

  describe('register', () => {
    it('lets an admin register an instrument, normalizing its codes', async () => {
      const accessToken = await signInAs({ isAdmin: true });

      const res = await registerInstrument(accessToken, {
        ...PETR4,
        symbol: ' petr4 ',
        type: 'stock',
        market: 'b3',
        currency: 'brl',
        country: 'br'
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.message, InstrumentMessages.CREATED);
      assert.deepEqual(await storedInstrument(PETR4.symbol), PETR4);
    });

    it('keeps a single instrument per symbol, regardless of case', async () => {
      const accessToken = await signInAs({ isAdmin: true });

      const first = await registerInstrument(accessToken, PETR4);
      const again = await registerInstrument(accessToken, {
        ...PETR4,
        symbol: PETR4.symbol.toLowerCase(),
        name: 'Petrobras'
      });

      assert.equal(first.status, 201);
      assert.equal(again.status, Errors.CONFLICT.status);
      assert.equal(again.body.message, InstrumentMessages.ALREADY_EXISTS);
      assert.deepEqual(
        await prismaClient.instrument.findMany({ select: CATALOG_ATTRIBUTES }),
        [PETR4]
      );
    });

    it('rejects attributes outside the catalog contract and registers nothing', async () => {
      const accessToken = await signInAs({ isAdmin: true });
      const invalidInstruments = [
        { ...PETR4, symbol: 'PETR.4' },
        { ...PETR4, type: 'COMMODITY' },
        { ...PETR4, currency: 'REAL' },
        { ...PETR4, country: 'BRA' },
        { ...PETR4, name: ' ' },
        { ...PETR4, name: 'N'.repeat(NAME_MAX_LENGTH + 1) },
        { ...PETR4, market: undefined },
        { ...PETR4, market: 'LSE' }
      ];

      for (const instrument of invalidInstruments) {
        const res = await registerInstrument(accessToken, instrument);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(instrument)
        );
      }

      assert.equal(await prismaClient.instrument.count(), 0);
    });
  });

  describe('update', () => {
    it('lets an admin complete the attributes of an instrument, never its symbol', async () => {
      const accessToken = await signInAs({ isAdmin: true });
      await createInstrument({
        symbol: PETR4.symbol,
        name: PETR4.symbol,
        type: InstrumentTypes.OTHER
      });

      const res = await client
        .patch(instrumentRoute(PETR4.symbol.toLowerCase()))
        .set(bearer(accessToken))
        .send({ ...PETR4, symbol: UNLISTED_SYMBOL });

      assert.equal(res.status, 200);
      assert.equal(res.body.message, InstrumentMessages.UPDATED);
      assert.deepEqual(await storedInstrument(PETR4.symbol), PETR4);
      assert.equal(await prismaClient.instrument.count(), 1);
    });

    it('rejects an update without attributes', async () => {
      const accessToken = await signInAs({ isAdmin: true });
      await createInstrument({ symbol: PETR4.symbol });

      for (const attributes of [{}, { symbol: UNLISTED_SYMBOL }]) {
        const res = await client
          .patch(instrumentRoute(PETR4.symbol))
          .set(bearer(accessToken))
          .send(attributes);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(attributes)
        );
      }
    });

    it('answers not found for a symbol outside the catalog', async () => {
      const accessToken = await signInAs({ isAdmin: true });

      const res = await client
        .patch(instrumentRoute(UNLISTED_SYMBOL))
        .set(bearer(accessToken))
        .send({ name: PETR4.name });

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, InstrumentMessages.NOT_FOUND);
      assert.equal(await prismaClient.instrument.count(), 0);
    });
  });

  describe('private instruments', () => {
    it('lists the catalog and the caller private instruments, never another user ones, telling them apart', async () => {
      const owner = await signInWithUser({ isAdmin: false });
      const other = await signInWithUser({
        isAdmin: false,
        email: OTHER_USER_EMAIL
      });
      await createInstrument({ symbol: PETR4.symbol, name: PETR4.name });
      await createInstrument({
        symbol: 'XPML11',
        name: 'XP Malls FII',
        ownerId: owner.user.id
      });
      await createInstrument({
        symbol: 'HGLG11',
        name: 'CSHG Logística FII',
        ownerId: other.user.id
      });

      assert.deepEqual(await listInstruments(owner.accessToken), [
        {
          symbol: PETR4.symbol,
          name: PETR4.name,
          scope: InstrumentScopes.CATALOG
        },
        {
          symbol: 'XPML11',
          name: 'XP Malls FII',
          scope: InstrumentScopes.PRIVATE
        }
      ]);
      assert.deepEqual(
        await listInstruments(owner.accessToken, { search: 'fii' }),
        [
          {
            symbol: 'XPML11',
            name: 'XP Malls FII',
            scope: InstrumentScopes.PRIVATE
          }
        ]
      );
    });

    it('never answers the owner of an instrument', async () => {
      const owner = await signInWithUser({ isAdmin: false });
      await createInstrument({ symbol: 'XPML11', ownerId: owner.user.id });

      const res = await client
        .get(INSTRUMENTS_ROUTE)
        .set(bearer(owner.accessToken));

      assert.equal(res.status, 200);
      assert.equal(Object.hasOwn(res.body.instruments[0], 'ownerId'), false);
    });

    it('lets a private instrument shadow a catalog one registered later under its symbol, for its owner alone', async () => {
      const owner = await signInWithUser({ isAdmin: false });
      const other = await signInWithUser({
        isAdmin: false,
        email: OTHER_USER_EMAIL
      });
      await createInstrument({
        symbol: 'XPML11',
        name: 'Mine',
        ownerId: owner.user.id
      });
      await createInstrument({ symbol: 'XPML11', name: 'Catalog' });

      assert.deepEqual(await listInstruments(owner.accessToken), [
        { symbol: 'XPML11', name: 'Mine', scope: InstrumentScopes.PRIVATE }
      ]);
      assert.deepEqual(await listInstruments(other.accessToken), [
        { symbol: 'XPML11', name: 'Catalog', scope: InstrumentScopes.CATALOG }
      ]);
    });

    it('lets the owner, and no one else, complete a private instrument', async () => {
      const owner = await signInWithUser({ isAdmin: false });
      const admin = await signInWithUser({
        isAdmin: true,
        email: OTHER_USER_EMAIL
      });
      const { id } = await createInstrument({
        symbol: 'XPML11',
        name: 'XPML11',
        ownerId: owner.user.id
      });

      const foreign = await client
        .patch(instrumentRoute('XPML11'))
        .set(bearer(admin.accessToken))
        .send({ name: 'Taken over' });
      const own = await client
        .patch(instrumentRoute('xpml11'))
        .set(bearer(owner.accessToken))
        .send({ name: 'XP Malls FII', sector: 'Shopping malls' });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, InstrumentMessages.NOT_FOUND);
      assert.equal(own.status, 200);
      assert.equal(own.body.instrument.scope, InstrumentScopes.PRIVATE);
      assert.deepEqual(
        await prismaClient.instrument.findUniqueOrThrow({
          where: { id },
          select: { name: true, sector: true, ownerId: true }
        }),
        {
          name: 'XP Malls FII',
          sector: 'Shopping malls',
          ownerId: owner.user.id
        }
      );
    });

    it('refuses a currency the market does not quote in, alone or together with the market', async () => {
      const accessToken = await signInAs({ isAdmin: true });
      await createInstrument({
        symbol: PETR4.symbol,
        market: PETR4.market,
        currency: PETR4.currency
      });

      const registered = await registerInstrument(accessToken, {
        ...PETR4,
        symbol: UNLISTED_SYMBOL,
        currency: 'USD'
      });
      const currencyAlone = await client
        .patch(instrumentRoute(PETR4.symbol))
        .set(bearer(accessToken))
        .send({ currency: 'USD' });
      const marketAlone = await client
        .patch(instrumentRoute(PETR4.symbol))
        .set(bearer(accessToken))
        .send({ market: 'NYSE' });
      const both = await client
        .patch(instrumentRoute(PETR4.symbol))
        .set(bearer(accessToken))
        .send({ market: 'NYSE', currency: 'USD' });

      for (const res of [registered, currencyAlone, marketAlone]) {
        assert.equal(res.status, Errors.DOMAIN.status);
        assert.equal(res.body.message, InstrumentMessages.CURRENCY_MISMATCH);
      }
      assert.equal(both.status, 200);
      assert.equal(await prismaClient.instrument.count(), 1);
    });

    it('answers what an instrument can be registered with', async () => {
      const accessToken = await signInAs({ isAdmin: false });

      const res = await client
        .get(INSTRUMENT_OPTIONS_ROUTE)
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, {
        types: Object.keys(InstrumentTypes),
        markets: Object.entries(MarketQuoteCurrencies).map(
          ([market, currency]) => ({ market, currency })
        )
      });
    });

    it('answers the options only to a signed-in user', async () => {
      const res = await client.get(INSTRUMENT_OPTIONS_ROUTE);

      assert.equal(res.status, Errors.AUTHENTICATION.status);
    });
  });

  describe('authorization', () => {
    it('does not let a user who is not an admin write the catalog', async () => {
      const accessToken = await signInAs({ isAdmin: false });
      const stored = await createInstrument({ symbol: PETR4.symbol });

      const registered = await registerInstrument(accessToken, {
        ...PETR4,
        symbol: UNLISTED_SYMBOL
      });
      const updated = await client
        .patch(instrumentRoute(PETR4.symbol))
        .set(bearer(accessToken))
        .send({ name: PETR4.name });

      assert.equal(registered.status, Errors.AUTHORIZATION.status);
      assert.equal(updated.status, Errors.AUTHORIZATION.status);
      assert.deepEqual(await prismaClient.instrument.findMany(), [stored]);
    });
  });

  describe('list', () => {
    it('lists the catalog to any signed-in user, ordered by symbol and paged', async () => {
      const limit = 2;
      const symbols = [UNLISTED_SYMBOL, 'ITUB4', PETR4.symbol];
      const accessToken = await signInAs({ isAdmin: false });

      for (const symbol of symbols) await createInstrument({ symbol });

      const pages = [];

      for (const page of [1, 2]) {
        const res = await client
          .get(INSTRUMENTS_ROUTE)
          .query({ page, limit })
          .set(bearer(accessToken));

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.pagination, {
          page,
          limit,
          total: symbols.length,
          totalPages: Math.ceil(symbols.length / limit)
        });
        pages.push(
          res.body.instruments.map(({ symbol }: { symbol: string }) => symbol)
        );
      }

      assert.deepEqual(pages.flat(), symbols.toSorted());
    });

    it('finds instruments by symbol prefix or by name, ignoring case, and pages only the matches', async () => {
      const accessToken = await signInAs({ isAdmin: false });

      await createInstrument({ symbol: PETR4.symbol, name: PETR4.name });
      await createInstrument({ symbol: 'PETR3', name: 'Petrobras ON' });
      await createInstrument({ symbol: UNLISTED_SYMBOL, name: 'Vale ON' });
      await createInstrument({ symbol: 'ITUB4', name: 'Itaú Unibanco PN' });

      const searchCatalog = async (search: string) => {
        const res = await client
          .get(INSTRUMENTS_ROUTE)
          .query({ search })
          .set(bearer(accessToken));

        assert.equal(res.status, 200);

        return {
          total: res.body.pagination.total,
          symbols: res.body.instruments.map(
            ({ symbol }: { symbol: string }) => symbol
          )
        };
      };

      assert.deepEqual(await searchCatalog('petr'), {
        total: 2,
        symbols: ['PETR3', 'PETR4']
      });
      assert.deepEqual(await searchCatalog('  vale on '), {
        total: 1,
        symbols: [UNLISTED_SYMBOL]
      });
      assert.deepEqual(await searchCatalog('ITAÚ'), {
        total: 1,
        symbols: ['ITUB4']
      });
      assert.deepEqual(await searchCatalog('bitcoin'), {
        total: 0,
        symbols: []
      });
    });

    it('rejects a search carrying a pattern wildcard instead of matching the whole catalog', async () => {
      const accessToken = await signInAs({ isAdmin: false });

      await createInstrument({ symbol: PETR4.symbol, name: PETR4.name });

      for (const search of ['%', '_', 'petr%', '\\']) {
        const res = await client
          .get(INSTRUMENTS_ROUTE)
          .query({ search })
          .set(bearer(accessToken));

        assert.equal(res.status, Errors.VALIDATION.status, search);
        assert.equal(res.body.code, Errors.VALIDATION.code);
        assert.equal(res.body.instruments, undefined);
      }
    });
  });

  describe('ownership', () => {
    it('removes the private instruments of a deleted user and their quotes, keeping the catalog', async () => {
      const holder = await seedPortfolio();
      const accessToken = await signIn({
        email: holder.user.email,
        password: FIXTURE_PASSWORD
      });
      const owned = await createInstrument({
        symbol: 'XPML11',
        ownerId: holder.user.id
      });
      await prismaClient.marketQuote.create({
        data: {
          instrumentId: owned.id,
          price: '100',
          currency: 'BRL',
          source: 'fixture',
          timestamp: new Date('2026-09-18T00:00:00.000Z')
        }
      });

      const res = await client
        .delete(USER_ROUTE)
        .set(bearer(accessToken))
        .send({ password: FIXTURE_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(await prismaClient.marketQuote.count(), 0);
      assert.deepEqual(
        await prismaClient.instrument.findMany({ select: { id: true } }),
        [{ id: holder.asset.instrumentId }]
      );
    });

    it('keeps an instrument after every user holding it is deleted', async () => {
      const holder = await seedPortfolio();
      const accessToken = await signIn({
        email: holder.user.email,
        password: FIXTURE_PASSWORD
      });

      const res = await client
        .delete(USER_ROUTE)
        .set(bearer(accessToken))
        .send({ password: FIXTURE_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(await prismaClient.position.count(), 0);
      assert.deepEqual(
        await prismaClient.instrument.findMany({ select: { id: true } }),
        [{ id: holder.asset.instrumentId }]
      );
    });
  });
});
