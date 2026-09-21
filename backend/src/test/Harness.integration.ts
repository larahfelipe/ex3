import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { InstrumentTypes } from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';

import {
  apiRequest,
  bearer,
  isAccountRateLimited,
  resetRateLimits,
  signIn
} from './ApiClient';
import {
  FIXTURE_ASSET_SYMBOL,
  FIXTURE_PASSWORD,
  seedPortfolio
} from './Fixtures';
import { registerIntegrationHooks } from './IntegrationHooks';
import { injectWriteFailure, resetDatabase } from './TestDatabase';

const PORTFOLIOS_ROUTE = '/v1/portfolios';

const prismaClient = PrismaClient.getInstance();

describe('test harness', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  it('seeds a portfolio holding one asset with one transaction', async () => {
    const { user, portfolio, asset, transaction } = await seedPortfolio();

    assert.equal(portfolio.userId, user.id);
    assert.equal(asset.portfolioId, portfolio.id);
    assert.equal(transaction.portfolioId, portfolio.id);
    assert.equal(transaction.instrumentId, asset.instrumentId);
    assert.equal(asset.quantity.toFixed(), transaction.quantity.toFixed());
  });

  it('empties every data table on reset', async () => {
    await seedPortfolio();

    await resetDatabase();

    const counts = await Promise.all([
      prismaClient.user.count(),
      prismaClient.portfolio.count(),
      prismaClient.instrument.count(),
      prismaClient.position.count(),
      prismaClient.transaction.count()
    ]);

    assert.deepEqual(counts, [0, 0, 0, 0, 0]);
  });

  it('authenticates a seeded user and reaches a protected route', async () => {
    const { user, portfolio } = await seedPortfolio();

    const accessToken = await signIn({
      email: user.email,
      password: FIXTURE_PASSWORD
    });

    const res = await client.get(PORTFOLIOS_ROUTE).set(bearer(accessToken));

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.portfolios.map(({ id }: { id: string }) => id),
      [portfolio.id]
    );
  });

  it('rejects a protected route without a token', async () => {
    const res = await client.get(PORTFOLIOS_ROUTE);

    assert.equal(res.status, 401);
  });

  it('clears the rate limit counters the limiter actually keeps', async () => {
    const { user } = await seedPortfolio();

    await signIn({ email: user.email, password: FIXTURE_PASSWORD });

    assert.ok(
      await isAccountRateLimited(user.email),
      'the signed-in account was not counted, so resetRateLimits clears nothing'
    );

    await resetRateLimits();

    assert.equal(await isAccountRateLimited(user.email), false);
  });

  it('fails only the injected write of a serializable transaction and undoes the writes before it', async (t) => {
    const failure = injectWriteFailure(t, 'instrument', 'update');

    const attempt = prismaClient.runSerializable(async (transactionClient) => {
      const { id } = await transactionClient.instrument.create({
        data: {
          symbol: FIXTURE_ASSET_SYMBOL,
          name: FIXTURE_ASSET_SYMBOL,
          type: InstrumentTypes.OTHER
        }
      });

      assert.equal(await transactionClient.instrument.count(), 1);

      await transactionClient.instrument.update({ where: { id }, data: {} });
    });

    await assert.rejects(attempt, failure);
    assert.equal(await prismaClient.instrument.count(), 0);
  });
});
