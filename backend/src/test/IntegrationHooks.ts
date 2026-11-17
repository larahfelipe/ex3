import { after, beforeEach } from 'node:test';

import { resetRateLimits } from './ApiClient';
import { disconnectDatabase, resetDatabase } from './TestDatabase';

export const registerIntegrationHooks = () => {
  beforeEach(async () => {
    await resetRateLimits();
    await resetDatabase();
  });

  after(() => disconnectDatabase());
};
