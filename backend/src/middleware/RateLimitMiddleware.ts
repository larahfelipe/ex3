import type { Request } from 'express';
import {
  MemoryStore,
  ipKeyGenerator,
  rateLimit,
  type RateLimitExceededEventHandler
} from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { Errors, ProxyHeaders, RateLimits } from '@/config/Constants';
import { envs } from '@/config/Envs';

type Budget = (typeof RateLimits)[keyof typeof RateLimits];

type KeyGenerator = (req: Request) => string;

type Accounting = {
  /**
   * Gives back the attempt of a request answered below 400, so a person who
   * signs in, or changes the account, spends nothing.
   */
  countsOnlyFailures: boolean;
  /**
   * Whether every response states the budget and what is left of it. A
   * credential endpoint shares its budgets with whoever else tries the same
   * account or address, so what is left would tell one caller about the
   * attempts of others; there a caller learns only when to retry, once turned
   * away.
   */
  disclosesBudget: boolean;
};

const BEARER_PREFIX = 'Bearer ';
const RETRY_AFTER_HEADER = 'Retry-After';
const MS_PER_SECOND = 1000;

const SESSION_NAMESPACE = 'session';
const ACCOUNT_NAMESPACE = 'account';
const ADDRESS_NAMESPACE = 'address';
const USER_NAMESPACE = 'user';

const digestOf = (value: string) => createHash('sha256').update(value).digest();

/**
 * The counter is keyed by a digest and never by the credential itself: the
 * store outlives the request, and a limiter is not a place to keep access
 * tokens or an address book of registered e-mails.
 */
const fingerprintOf = (namespace: string, value: string) =>
  `${namespace}:${digestOf(value).toString('base64url')}`;

const proxySecretDigest =
  envs.apiProxySecret === undefined ? null : digestOf(envs.apiProxySecret);

/**
 * Compared as digests, so the comparison takes the same time whatever the
 * length or content of the secret presented.
 */
const isVouchedByWeb = (req: Request) => {
  const presentedSecret = req.get(ProxyHeaders.PROXY_SECRET);

  return (
    proxySecretDigest !== null &&
    presentedSecret !== undefined &&
    timingSafeEqual(digestOf(presentedSecret), proxySecretDigest)
  );
};

/**
 * Every browser request reaches the API from the web server, so the socket
 * names the web and not the person. The web names the client in a header the
 * API believes only beside the secret both share; any other caller is counted
 * under the address it connects from, which a header cannot change.
 */
const clientAddressOf = (req: Request) => {
  const vouchedAddress = req.get(ProxyHeaders.CLIENT_ADDRESS);

  return vouchedAddress !== undefined &&
    isIP(vouchedAddress) !== 0 &&
    isVouchedByWeb(req)
    ? vouchedAddress
    : (req.ip ?? '');
};

/** An IPv6 address counts by its /56 prefix, which one subscriber holds whole. */
const clientAddressKey: KeyGenerator = (req) =>
  `${ADDRESS_NAMESPACE}:${ipKeyGenerator(clientAddressOf(req))}`;

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

/** Traffic that carries no session at all is counted per client address. */
const sessionKey: KeyGenerator = (req) => {
  const session = submittedSessionOf(req);

  return session
    ? fingerprintOf(SESSION_NAMESPACE, session)
    : clientAddressKey(req);
};

const accountKey: KeyGenerator = (req) => {
  const account = submittedAccountOf(req);

  return account ? accountRateLimitKey(account) : clientAddressKey(req);
};

const accountAndAddressKey: KeyGenerator = (req) =>
  `${accountKey(req)}|${clientAddressKey(req)}`;

/** Only for a route behind `authMiddleware`, which has already resolved the user. */
const signedInUserKey: KeyGenerator = (req) =>
  `${USER_NAMESPACE}:${req.user.id}`;

/**
 * The limiter answers on its own, without reaching the error boundary, so the
 * envelope and the code the request log reports are written here. The generic
 * message and `Retry-After` are all a throttled caller learns: nothing says
 * which budget ran out, or whether the account exists. The limiter writes
 * `Retry-After` only beside the budget headers, so a limiter that keeps its
 * budget undisclosed has it written here.
 */
const rejectThrottledRequest: RateLimitExceededEventHandler = (req, res) => {
  req.errorCode = Errors.THROTTLED.code;

  const resetTime = req.rateLimit?.resetTime;

  if (resetTime !== undefined && !res.hasHeader(RETRY_AFTER_HEADER))
    res.setHeader(
      RETRY_AFTER_HEADER,
      Math.max(
        Math.ceil((resetTime.getTime() - Date.now()) / MS_PER_SECOND),
        0
      ).toString()
    );

  res.status(Errors.THROTTLED.status).json({
    code: Errors.THROTTLED.code,
    message: Errors.THROTTLED.message,
    details: []
  });
};

const limiterOf = (
  { windowMs, limit }: Budget,
  store: MemoryStore,
  keyGenerator: KeyGenerator,
  { countsOnlyFailures, disclosesBudget }: Accounting
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: disclosesBudget ? 'draft-8' : false,
    legacyHeaders: false,
    store,
    keyGenerator,
    skipSuccessfulRequests: countsOnlyFailures,
    handler: rejectThrottledRequest
  });

const CREDENTIAL_ATTEMPTS: Accounting = {
  countsOnlyFailures: true,
  disclosesBudget: false
};

const EVERY_REQUEST: Accounting = {
  countsOnlyFailures: false,
  disclosesBudget: true
};

const signInPerAddressStore = new MemoryStore();
const signInPerAccountAndAddressStore = new MemoryStore();
const signInPerAccountStore = new MemoryStore();
const signUpPerAddressStore = new MemoryStore();
const accountChangeStore = new MemoryStore();
const apiRateLimitStore = new MemoryStore();
const instrumentSearchRateLimitStore = new MemoryStore();

/**
 * Counters live in the memory of one process, so a suite that authenticates
 * repeatedly clears them between tests through these stores.
 */
export const rateLimitStores = [
  signInPerAddressStore,
  signInPerAccountAndAddressStore,
  signInPerAccountStore,
  signUpPerAddressStore,
  accountChangeStore,
  apiRateLimitStore,
  instrumentSearchRateLimitStore
];

export const signInPerAccountRateLimitMiddleware = limiterOf(
  RateLimits.SIGN_IN_PER_ACCOUNT,
  signInPerAccountStore,
  accountKey,
  CREDENTIAL_ATTEMPTS
);

/**
 * The sign-in layers of `RateLimits`, in the order they count: a request one
 * of them turns away is not counted by those after it.
 */
export const signInRateLimitMiddleware = [
  limiterOf(
    RateLimits.SIGN_IN_PER_ADDRESS,
    signInPerAddressStore,
    clientAddressKey,
    CREDENTIAL_ATTEMPTS
  ),
  limiterOf(
    RateLimits.SIGN_IN_PER_ACCOUNT_AND_ADDRESS,
    signInPerAccountAndAddressStore,
    accountAndAddressKey,
    CREDENTIAL_ATTEMPTS
  ),
  signInPerAccountRateLimitMiddleware
];

export const signUpRateLimitMiddleware = limiterOf(
  RateLimits.SIGN_UP_PER_ADDRESS,
  signUpPerAddressStore,
  clientAddressKey,
  { countsOnlyFailures: false, disclosesBudget: false }
);

export const accountChangeRateLimitMiddleware = limiterOf(
  RateLimits.ACCOUNT_CHANGE,
  accountChangeStore,
  sessionKey,
  { countsOnlyFailures: true, disclosesBudget: true }
);

export const instrumentSearchRateLimitMiddleware = limiterOf(
  RateLimits.INSTRUMENT_SEARCH,
  instrumentSearchRateLimitStore,
  signedInUserKey,
  EVERY_REQUEST
);

export const apiRateLimitMiddleware = limiterOf(
  RateLimits.API,
  apiRateLimitStore,
  sessionKey,
  EVERY_REQUEST
);
