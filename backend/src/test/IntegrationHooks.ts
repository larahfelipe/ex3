import { after, beforeEach } from 'node:test';

import { resetRateLimits } from './ApiClient';
import { disconnectDatabase, resetDatabase } from './TestDatabase';

/**
 * Per-file setup shared by every integration suite: a database holding only the
 * rows the running test created, rate limit counters that do not carry over,
 * and a closed connection pool at the end. The last one matters beyond
 * tidiness — an open pool keeps the test process alive for its whole idle
 * timeout, which the runner waits out before reporting.
 */
export const registerIntegrationHooks = () => {
  beforeEach(async () => {
    await resetRateLimits();
    await resetDatabase();
  });

  after(() => disconnectDatabase());
};
