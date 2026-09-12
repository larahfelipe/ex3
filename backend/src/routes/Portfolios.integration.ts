import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Errors, PortfolioMessages } from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import { FIXTURE_PASSWORD, createPortfolio, createUser } from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const PORTFOLIO_ROUTE = '/v1/portfolio';
const PORTFOLIOS_ROUTE = '/v1/portfolios';

/** Mirror `CreatePortfolioSchema`, `PaginationQuerySchema` and the default page size in `PortfolioRepository.getAll`. */
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
});
