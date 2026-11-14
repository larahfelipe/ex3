import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Errors } from '@/config/Constants';
import { UnavailableError } from '@/errors';
import type { LogEntry } from '@/infra/observability';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

import { PrismaClient } from './PrismaClient';
import { RateLimitStore } from './RateLimitStore';

const PREFIX = 'store-test';
const OTHER_PREFIX = 'store-test-other';
const KEY = 'address:192.0.2.10';
const OTHER_KEY = 'address:203.0.113.10';
const WINDOW_MS = 60_000;
const CONCURRENT_HITS = 40;
const STORE_FAILURE = 'connection terminated unexpectedly';

const prismaClient = PrismaClient.getInstance();

const processStore = (
  prefix = PREFIX,
  logEntry: (entry: LogEntry) => void = () => undefined
) => {
  const store = new RateLimitStore({ prefix, logEntry });

  store.init({ windowMs: WINDOW_MS });

  return store;
};

const closeWindowOf = (prefix: string, key: string) =>
  prismaClient.rateLimitCounter.update({
    where: { key: `${prefix}:${key}` },
    data: { resetAt: new Date(Date.now() - 1) }
  });

describe('rate limit store', () => {
  registerIntegrationHooks();

  it('counts concurrent hits once each, none lost or repeated', async () => {
    const store = processStore();

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_HITS }, () => store.increment(KEY))
    );

    assert.deepEqual(
      results.map(({ totalHits }) => totalHits).sort((a, b) => a - b),
      Array.from({ length: CONCURRENT_HITS }, (_, index) => index + 1)
    );
    assert.equal((await store.get(KEY))?.totalHits, CONCURRENT_HITS);
  });

  it('shares one count between the processes that use a prefix', async () => {
    const first = processStore();
    const second = processStore();

    await Promise.all([
      first.increment(KEY),
      second.increment(KEY),
      first.increment(KEY),
      second.increment(KEY)
    ]);

    const { totalHits, resetTime } = await second.increment(KEY);

    assert.equal(totalHits, 5);
    assert.deepEqual((await first.get(KEY))?.resetTime, resetTime);
  });

  it('keeps the window where its first hit opened it', async () => {
    const store = processStore();

    const opened = await store.increment(KEY);
    const later = await store.increment(KEY);

    assert.deepEqual(later.resetTime, opened.resetTime);
    assert.ok(opened.resetTime.getTime() > Date.now());
    assert.ok(opened.resetTime.getTime() <= Date.now() + WINDOW_MS);
  });

  it('starts a new window once the last one closed', async () => {
    const store = processStore();

    await store.increment(KEY);
    await store.increment(KEY);
    await closeWindowOf(PREFIX, KEY);

    assert.equal(await store.get(KEY), undefined);

    const reopened = await store.increment(KEY);

    assert.equal(reopened.totalHits, 1);
    assert.ok(reopened.resetTime.getTime() > Date.now());
  });

  it('gives back a hit without going below zero', async () => {
    const store = processStore();

    await store.increment(KEY);
    await store.decrement(KEY);
    await store.decrement(KEY);

    assert.equal((await store.get(KEY))?.totalHits, 0);
  });

  it('keeps the counts of other prefixes and keys apart', async () => {
    const store = processStore();
    const other = processStore(OTHER_PREFIX);

    await store.increment(KEY);
    await store.increment(OTHER_KEY);
    await other.increment(KEY);
    await store.resetKey(OTHER_KEY);

    assert.equal((await store.get(KEY))?.totalHits, 1);
    assert.equal(await store.get(OTHER_KEY), undefined);

    await store.resetAll();

    assert.equal(await store.get(KEY), undefined);
    assert.equal((await other.get(KEY))?.totalHits, 1);
  });

  it('removes only the closed windows of its own prefix when it sweeps', async () => {
    const store = processStore();
    const other = processStore(OTHER_PREFIX);

    await store.increment(KEY);
    await store.increment(OTHER_KEY);
    await other.increment(KEY);
    await closeWindowOf(PREFIX, KEY);
    await closeWindowOf(OTHER_PREFIX, KEY);

    await store.sweep();

    assert.deepEqual(
      (await prismaClient.rateLimitCounter.findMany({ select: { key: true } }))
        .map(({ key }) => key)
        .sort(),
      [`${OTHER_PREFIX}:${KEY}`, `${PREFIX}:${OTHER_KEY}`]
    );
  });

  it('refuses to count, instead of letting the hit through, when the database fails', async (t) => {
    const entries: LogEntry[] = [];
    const store = processStore(PREFIX, (entry) => entries.push(entry));

    t.mock.method(PrismaClient.prototype, '$queryRaw', () =>
      Promise.reject(new Error(STORE_FAILURE))
    );

    await assert.rejects(store.increment(KEY), (error: unknown) => {
      assert.ok(error instanceof UnavailableError);
      assert.equal(error.status, Errors.UNAVAILABLE.status);
      assert.ok(!error.message.includes(STORE_FAILURE));

      return true;
    });
    assert.partialDeepStrictEqual(entries, [
      {
        severity: 'ERROR',
        event: 'rate_limit_store_failed',
        operation: 'increment',
        reason: STORE_FAILURE
      }
    ]);
  });

  it('leaves the hit counted when giving it back fails', async (t) => {
    const entries: LogEntry[] = [];
    const store = processStore(PREFIX, (entry) => entries.push(entry));

    await store.increment(KEY);

    const failure = t.mock.method(PrismaClient.prototype, '$executeRaw', () =>
      Promise.reject(new Error(STORE_FAILURE))
    );

    await store.decrement(KEY);
    failure.mock.restore();

    assert.equal((await store.get(KEY))?.totalHits, 1);
    assert.partialDeepStrictEqual(entries, [
      { event: 'rate_limit_store_failed', operation: 'decrement' }
    ]);
  });
});
