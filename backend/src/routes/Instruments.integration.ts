import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Errors, InstrumentMessages, InstrumentTypes } from '@/config';
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
  prismaClient.instrument.findUniqueOrThrow({
    where: { symbol },
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
      assert.equal(again.status, Errors.BAD_REQUEST.status);
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
          Errors.BAD_REQUEST.status,
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
          Errors.BAD_REQUEST.status,
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

      assert.equal(registered.status, Errors.FORBIDDEN.status);
      assert.equal(updated.status, Errors.FORBIDDEN.status);
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
  });

  describe('ownership', () => {
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
