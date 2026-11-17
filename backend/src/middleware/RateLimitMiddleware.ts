import type { Request } from 'express';
import {
  ipKeyGenerator,
  rateLimit,
  type RateLimitExceededEventHandler
} from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { Errors, ProxyHeaders, RateLimits } from '@/config/Constants';
import { envs } from '@/config/Envs';
import { RateLimitStore } from '@/infra/database/RateLimitStore';

type BudgetName = keyof typeof RateLimits;

type KeyGenerator = (req: Request) => string;

type Accounting = {
  countsOnlyFailures: boolean;
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

export const clientAddressOf = (req: Request) => {
  const vouchedAddress = req.get(ProxyHeaders.CLIENT_ADDRESS);

  return vouchedAddress !== undefined &&
    isIP(vouchedAddress) !== 0 &&
    isVouchedByWeb(req)
    ? vouchedAddress
    : (req.ip ?? '');
};

export const addressRateLimitKey = (address: string) =>
  `${ADDRESS_NAMESPACE}:${ipKeyGenerator(address)}`;

const clientAddressKey: KeyGenerator = (req) =>
  addressRateLimitKey(clientAddressOf(req));

const submittedSessionOf = (req: Request) => {
  const authorization = req.get('authorization') ?? '';

  return authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : null;
};

export const accountRateLimitKey = (email: string) =>
  fingerprintOf(ACCOUNT_NAMESPACE, email.trim().toLowerCase());

const submittedAccountOf = (req: Request) => {
  const { email } = (req.body ?? {}) as Record<'email', unknown>;

  return typeof email === 'string' && email.trim().length > 0 ? email : null;
};

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

const signedInUserKey: KeyGenerator = (req) =>
  `${USER_NAMESPACE}:${req.user.id}`;

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

export const rateLimitStores: RateLimitStore[] = [];

const limiterOf = (
  budgetName: BudgetName,
  keyGenerator: KeyGenerator,
  { countsOnlyFailures, disclosesBudget }: Accounting
) => {
  const { windowMs, limit } = RateLimits[budgetName];
  const store = new RateLimitStore({ prefix: budgetName });

  rateLimitStores.push(store);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: disclosesBudget ? 'draft-8' : false,
    legacyHeaders: false,
    store,
    keyGenerator,
    skipSuccessfulRequests: countsOnlyFailures,
    handler: rejectThrottledRequest
  });
};

const CREDENTIAL_ATTEMPTS: Accounting = {
  countsOnlyFailures: true,
  disclosesBudget: false
};

const EVERY_ATTEMPT: Accounting = {
  countsOnlyFailures: false,
  disclosesBudget: false
};

const EVERY_REQUEST: Accounting = {
  countsOnlyFailures: false,
  disclosesBudget: true
};

export const signInPerAccountRateLimitMiddleware = limiterOf(
  'SIGN_IN_PER_ACCOUNT',
  accountKey,
  CREDENTIAL_ATTEMPTS
);

export const signInAddressRateLimitMiddleware = [
  limiterOf('SIGN_IN_PER_ADDRESS_DAILY', clientAddressKey, CREDENTIAL_ATTEMPTS),
  limiterOf('SIGN_IN_PER_ADDRESS', clientAddressKey, CREDENTIAL_ATTEMPTS)
];

export const signInAccountRateLimitMiddleware = [
  limiterOf(
    'SIGN_IN_PER_ACCOUNT_AND_ADDRESS',
    accountAndAddressKey,
    CREDENTIAL_ATTEMPTS
  ),
  signInPerAccountRateLimitMiddleware
];

export const signUpRateLimitMiddleware = [
  limiterOf('SIGN_UP_PER_ADDRESS_DAILY', clientAddressKey, EVERY_ATTEMPT),
  limiterOf('SIGN_UP_PER_ADDRESS', clientAddressKey, EVERY_ATTEMPT)
];

export const accountChangeRateLimitMiddleware = limiterOf(
  'ACCOUNT_CHANGE',
  sessionKey,
  { countsOnlyFailures: true, disclosesBudget: true }
);

export const instrumentSearchRateLimitMiddleware = limiterOf(
  'INSTRUMENT_SEARCH',
  signedInUserKey,
  EVERY_REQUEST
);

export const transactionImportRateLimitMiddleware = limiterOf(
  'TRANSACTION_IMPORT',
  signedInUserKey,
  EVERY_REQUEST
);

export const apiRateLimitMiddleware = limiterOf(
  'API',
  sessionKey,
  EVERY_REQUEST
);
