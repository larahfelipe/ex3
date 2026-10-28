import type { Express } from 'express';
import request from 'supertest';

import {
  accountRateLimitKey,
  rateLimitStores,
  signInPerAccountRateLimitMiddleware
} from '@/middleware/RateLimitMiddleware';

import {
  FIXTURE_PASSWORD,
  createPortfolio,
  createUser,
  seedPortfolio
} from './Fixtures';

const SIGN_IN_ROUTE = '/v1/user';

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
export const resetRateLimits = async () => {
  await Promise.all(rateLimitStores.map((store) => store.resetAll()));
};

/**
 * Whether the per-account sign-in limiter is counting the account the
 * credentials name. The harness test reads it to prove `resetRateLimits` clears
 * the key the limiter actually derives, instead of silently clearing nothing.
 */
export const isAccountRateLimited = async (email: string) =>
  (await signInPerAccountRateLimitMiddleware.getKey(
    accountRateLimitKey(email)
  )) !== undefined;

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

export const signInUser = async (email?: string) => {
  const user = await createUser(email === undefined ? {} : { email });
  const accessToken = await signIn({
    email: user.email,
    password: FIXTURE_PASSWORD
  });

  return { user, accessToken };
};

export const signInWithPortfolio = async (email?: string) => {
  const { user, accessToken } = await signInUser(email);
  const portfolio = await createPortfolio(user.id);

  return { user, portfolio, accessToken };
};

export const signInSeeded = async (
  overrides: Parameters<typeof seedPortfolio>[0] = {}
) => {
  const seeded = await seedPortfolio(overrides);
  const accessToken = await signIn({
    email: seeded.user.email,
    password: FIXTURE_PASSWORD
  });

  return { ...seeded, accessToken };
};
