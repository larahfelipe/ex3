import type { Request } from 'express';
import {
  MemoryStore,
  ipKeyGenerator,
  rateLimit,
  type RateLimitExceededEventHandler
} from 'express-rate-limit';
import { createHash } from 'node:crypto';

import { Errors, RateLimits } from '@/config/Constants';

const BEARER_PREFIX = 'Bearer ';

const SESSION_NAMESPACE = 'session';
const ACCOUNT_NAMESPACE = 'account';

/**
 * The counter is keyed by a digest and never by the credential itself: the
 * store outlives the request, and a limiter is not a place to keep access
 * tokens or an address book of registered e-mails.
 */
const fingerprintOf = (namespace: string, value: string) =>
  `${namespace}:${createHash('sha256').update(value).digest('base64url')}`;

const clientAddressKey = (req: Request) => ipKeyGenerator(req.ip ?? '');

const submittedSessionOf = (req: Request) => {
  const authorization = req.get('authorization') ?? '';

  return authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : null;
};

/** Normalized as the schemas normalize it, so both name the same account. */
export const accountRateLimitKey = (email: string) =>
  fingerprintOf(ACCOUNT_NAMESPACE, email.trim().toLowerCase());

const submittedAccountOf = (req: Request) => {
  const { email } = (req.body ?? {}) as Record<'email', unknown>;

  return typeof email === 'string' && email.trim().length > 0 ? email : null;
};

/**
 * Every browser request reaches the API through the web server, so the client
 * address identifies that one proxy and not the caller: an authenticated
 * request is counted per session, and only traffic that carries no session at
 * all shares the address bucket.
 */
const sessionKey = (req: Request) => {
  const session = submittedSessionOf(req);

  return session
    ? fingerprintOf(SESSION_NAMESPACE, session)
    : clientAddressKey(req);
};

/**
 * Password guessing is counted per account: by the session when the route
 * verifies the password of the caller's own account, by the submitted e-mail
 * when there is no session to answer for it.
 */
const credentialKey = (req: Request) => {
  const session = submittedSessionOf(req);

  if (session) return fingerprintOf(SESSION_NAMESPACE, session);

  const account = submittedAccountOf(req);

  return account ? accountRateLimitKey(account) : clientAddressKey(req);
};

/**
 * The limiter answers on its own, without reaching the error boundary, so the
 * envelope and the code the request log reports are written here.
 */
const rejectThrottledRequest: RateLimitExceededEventHandler = (req, res) => {
  req.errorCode = Errors.THROTTLED.code;

  res.status(Errors.THROTTLED.status).json({
    code: Errors.THROTTLED.code,
    message: Errors.THROTTLED.message,
    details: []
  });
};

const authRateLimitStore = new MemoryStore();
const apiRateLimitStore = new MemoryStore();

/**
 * Counters live in the memory of one process, so a suite that authenticates
 * repeatedly clears them between tests through these stores.
 */
export const rateLimitStores = [authRateLimitStore, apiRateLimitStore];

/**
 * Credential endpoints are the cheapest target for online guessing, so they get
 * a budget an order of magnitude tighter than the rest of the API.
 */
export const authRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.AUTH.windowMs,
  limit: RateLimits.AUTH.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: authRateLimitStore,
  keyGenerator: credentialKey,
  handler: rejectThrottledRequest
});

export const apiRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.API.windowMs,
  limit: RateLimits.API.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: apiRateLimitStore,
  keyGenerator: sessionKey,
  handler: rejectThrottledRequest
});
