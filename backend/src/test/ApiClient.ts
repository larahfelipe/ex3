import type { Express } from 'express';
import request from 'supertest';

import {
  apiRateLimitMiddleware,
  authRateLimitMiddleware
} from '@/middleware/RateLimitMiddleware';

const SIGN_IN_ROUTE = '/v1/user';

/**
 * Keys that `express-rate-limit` derives for the client supertest connects
 * from: IPv4 loopback, or its IPv6-mapped form when the ephemeral server binds
 * a dual-stack socket. Covered by the harness test, which asserts one of them
 * is tracked after a request.
 */
const LOOPBACK_KEYS = ['127.0.0.1', '::ffff:127.0.0.1'];

let application: Express | null = null;

/**
 * `@/config` validates the environment and builds the app at import time, so it
 * is imported only once the test process is running under `.env.test`.
 */
const app = async () => {
  if (!application) ({ app: application } = await import('@/config'));

  return application;
};

export const apiRequest = async () => request(await app());

/**
 * The rate limiters keep their counters in process memory, which outlives a
 * single test. Budgets are tight by design, so a suite that authenticates
 * repeatedly has to clear them between tests.
 */
export const resetRateLimits = () => {
  for (const key of LOOPBACK_KEYS) {
    authRateLimitMiddleware.resetKey(key);
    apiRateLimitMiddleware.resetKey(key);
  }
};

/**
 * Which of the loopback keys the auth limiter is currently counting. The
 * harness test reads it to prove `resetRateLimits` targets the key the limiter
 * actually derives, instead of silently clearing nothing.
 */
export const trackedRateLimitKeys = async () => {
  const tracked = await Promise.all(
    LOOPBACK_KEYS.map(async (key) =>
      (await authRateLimitMiddleware.getKey(key)) ? key : null
    )
  );

  return tracked.filter((key): key is string => key !== null);
};

export const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`
});

export class SignInFailedError extends Error {
  constructor(status: number, body: unknown) {
    super(`Sign-in failed with ${status}: ${JSON.stringify(body)}`);
    this.name = 'SignInFailedError';
  }
}

/**
 * Authenticates through the real endpoint rather than signing a token locally:
 * sessions are stateful, and only the endpoint stores the token on the user row
 * that `authMiddleware` checks against.
 */
export const signIn = async (credentials: {
  email: string;
  password: string;
}) => {
  const res = await (await apiRequest()).post(SIGN_IN_ROUTE).send(credentials);

  if (res.status !== 200) throw new SignInFailedError(res.status, res.body);

  return res.body.accessToken as string;
};
