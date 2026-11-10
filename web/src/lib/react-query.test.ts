import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ApiProxyError } from '@/lib/axios';

import { getQueryClient, isReloadable, isRequestRejected } from './react-query';

const apiError = (status: number) =>
  new ApiProxyError('Unexpected error', { status });

describe('a failed request', () => {
  it('is rejected for good when the API refuses it', () => {
    assert.equal(isRequestRejected(apiError(404)), true);
    assert.equal(isReloadable(apiError(404)), false);
    assert.equal(isReloadable(apiError(400)), false);
  });

  it('may reload when the server or the network failed', () => {
    assert.equal(isRequestRejected(apiError(503)), false);
    assert.equal(isReloadable(apiError(503)), true);
    assert.equal(isReloadable(new Error('Network Error')), true);
  });

  it('may reload once the API stops throttling it, though it is not retried at once', () => {
    assert.equal(isRequestRejected(apiError(429)), true);
    assert.equal(isReloadable(apiError(429)), true);
  });
});

describe('the query client', () => {
  it('is a new one for every server render, so no visitor shares a cache', () => {
    assert.notEqual(getQueryClient(), getQueryClient());
  });
});
