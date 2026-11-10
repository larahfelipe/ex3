import {
  QueryClient,
  QueryObserver,
  type QueryKey
} from '@tanstack/react-query';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type {
  GetPortfolioOverviewResponseData,
  MarketDataStatus
} from '@/app/api/v1/portfolio';
import type {
  GetPortfoliosResponseData,
  Portfolio
} from '@/app/api/v1/portfolios';
import { ApiProxyError } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';

import {
  listedPortfolioOf,
  previousPageOfPortfolio,
  refreshPortfolioScope
} from './use-portfolio';

const portfolioNamed = (id: string, name: string): Portfolio => ({
  id,
  name,
  baseCurrency: 'BRL',
  createdAt: '2026-01-02T12:00:00.000Z',
  updatedAt: '2026-01-02T12:00:00.000Z'
});

const RETIREMENT = portfolioNamed('6f1c2a4e-3b5d-4c7e-8f90-1a2b3c4d5e6f', 'A');
const TRADING = portfolioNamed('0b6a9f1e-7c2d-4e3f-9a8b-5c4d3e2f1a0b', 'B');

const COMPLETE: MarketDataStatus = {
  valuedPositionCount: 1,
  missingQuotes: [],
  missingRates: [],
  isFallback: false,
  isStale: false
};

const overviewWith = (
  marketData: MarketDataStatus
): GetPortfolioOverviewResponseData => ({
  baseCurrency: 'BRL',
  heldPositionCount: 1,
  totalValue: '100',
  marketData
});

const clients: Array<QueryClient> = [];
const unsubscribers: Array<VoidFunction> = [];

const newQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  clients.push(queryClient);

  return queryClient;
};

/** A query on screen: one with an observer, which an invalidation refetches. */
const observe = (
  queryClient: QueryClient,
  queryKey: QueryKey,
  queryFn: () => Promise<unknown>
) => {
  const observer = new QueryObserver(queryClient, { queryKey, queryFn });

  unsubscribers.push(observer.subscribe(() => undefined));
};

const settled = (queryClient: QueryClient) =>
  Promise.allSettled(
    queryClient
      .getQueryCache()
      .getAll()
      .flatMap(({ promise }) => (promise ? [promise] : []))
  );

afterEach(() => {
  unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  clients.splice(0).forEach((queryClient) => queryClient.clear());
});

describe('switching portfolios', () => {
  const previousQueryOf = (portfolioId: string) => ({
    queryKey: queryKeys.positions(portfolioId, { page: 2, pageSize: 10 })
  });

  it("keeps a portfolio's previous page on screen while its next one loads", () => {
    const previousPage = { items: ['PETR4'] };

    assert.equal(
      previousPageOfPortfolio(RETIREMENT.id)(
        previousPage,
        previousQueryOf(RETIREMENT.id)
      ),
      previousPage
    );
  });

  it("never stands another portfolio's figures in for the new one", () => {
    assert.equal(
      previousPageOfPortfolio(TRADING.id)(
        { items: ['PETR4'] },
        previousQueryOf(RETIREMENT.id)
      ),
      undefined
    );
    assert.equal(
      previousPageOfPortfolio(TRADING.id)({ items: [] }, undefined),
      undefined
    );
  });

  it('shows the chosen portfolio as a listed page has it, and nothing for one no page lists', () => {
    const queryClient = newQueryClient();
    const listing: GetPortfoliosResponseData = {
      portfolios: [RETIREMENT, TRADING],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 }
    };

    queryClient.setQueryData(queryKeys.portfolioPage({ page: 1, limit: 100 }), {
      data: listing,
      status: 200
    });
    queryClient.setQueryData(
      queryKeys.portfolioDetails('5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'),
      { data: portfolioNamed('5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a', 'C') }
    );

    assert.deepEqual(listedPortfolioOf(queryClient, TRADING.id), {
      data: TRADING,
      status: 200
    });
    assert.equal(
      listedPortfolioOf(queryClient, '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'),
      undefined
    );
    assert.equal(listedPortfolioOf(queryClient, null), undefined);
  });
});

describe('refreshing a portfolio', () => {
  it('joins the requests already running instead of sending them again', async () => {
    const queryClient = newQueryClient();
    const pending: Array<VoidFunction> = [];
    let requests = 0;
    const answer = () => pending.splice(0).forEach((resolve) => resolve());

    observe(
      queryClient,
      queryKeys.portfolioOverview(RETIREMENT.id),
      () =>
        new Promise((resolve) => {
          requests += 1;
          pending.push(() => resolve({ data: overviewWith(COMPLETE) }));
        })
    );
    answer();
    await settled(queryClient);

    const refreshes = Promise.all([
      refreshPortfolioScope(queryClient, RETIREMENT.id, {
        cancelRefetch: false
      }),
      refreshPortfolioScope(queryClient, RETIREMENT.id, {
        cancelRefetch: false
      })
    ]);

    answer();

    assert.deepEqual(await refreshes, ['reloaded', 'reloaded']);
    assert.equal(requests, 2);
  });

  it("refreshes only the portfolio's own queries", async () => {
    const queryClient = newQueryClient();
    const requests = new Map<string, number>();
    const counting = (portfolio: Portfolio) => () => {
      requests.set(portfolio.id, (requests.get(portfolio.id) ?? 0) + 1);

      return Promise.resolve({ data: overviewWith(COMPLETE) });
    };

    observe(
      queryClient,
      queryKeys.portfolioOverview(RETIREMENT.id),
      counting(RETIREMENT)
    );
    observe(
      queryClient,
      queryKeys.portfolioOverview(TRADING.id),
      counting(TRADING)
    );
    await settled(queryClient);

    await refreshPortfolioScope(queryClient, RETIREMENT.id);

    assert.equal(requests.get(RETIREMENT.id), 2);
    assert.equal(requests.get(TRADING.id), 1);
  });

  it('tells a value still resting on missing, fallback or stale market data', async () => {
    for (const marketData of [
      { ...COMPLETE, isStale: true },
      { ...COMPLETE, isFallback: true },
      {
        ...COMPLETE,
        valuedPositionCount: 0,
        missingQuotes: [{ symbol: 'VALE3', reason: 'unavailable' as const }]
      }
    ]) {
      const queryClient = newQueryClient();

      observe(queryClient, queryKeys.portfolioOverview(RETIREMENT.id), () =>
        Promise.resolve({ data: overviewWith(marketData) })
      );

      assert.equal(
        await refreshPortfolioScope(queryClient, RETIREMENT.id),
        'degraded'
      );
    }
  });

  it('fails when a section on screen could load later, not when the API refused it', async () => {
    const failingWith = async (status: number) => {
      const queryClient = newQueryClient();

      observe(queryClient, queryKeys.portfolioOverview(RETIREMENT.id), () =>
        Promise.resolve({ data: overviewWith(COMPLETE) })
      );
      observe(queryClient, queryKeys.allocation(RETIREMENT.id), () =>
        Promise.reject(new ApiProxyError('Unexpected error', { status }))
      );

      return refreshPortfolioScope(queryClient, RETIREMENT.id);
    };

    assert.equal(await failingWith(503), 'failed');
    assert.equal(await failingWith(429), 'failed');
    assert.equal(await failingWith(404), 'reloaded');
  });
});
