import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { envs } from '@/config';
import type { User } from '@/domain/models';
import { AuthenticationError } from '@/errors';

const SECRET = envs.jwtSecret;
const USER_ID = '0f2f5a3c-2c1c-4f2a-9a1a-7c6f5d4e3b2a';
const SESSION_VERSION = 4;

type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

type StoredUser = Pick<User, 'id' | 'sessionVersion'> | null;

const makeRequest = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as Request;

const captureNext = () => {
  const calls: Array<unknown> = [];

  const next = ((e?: unknown) => {
    calls.push(e);
  }) as NextFunction;

  return { next, calls };
};

const signSession = (
  claims = { sub: USER_ID, sessionVersion: SESSION_VERSION },
  options: jwt.SignOptions = { expiresIn: '1h' },
  secret = SECRET
) => jwt.sign(claims, secret, options);

describe('authMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let storedUser: StoredUser;

  before(async () => {
    const { UserRepository } = await import('@/infra/database');

    mock.method(
      UserRepository.getInstance(),
      'getById',
      async () => storedUser as User
    );

    ({ authMiddleware } = (await import('./AuthMiddleware')) as {
      authMiddleware: AuthMiddleware;
    });
  });

  after(() => mock.restoreAll());

  beforeEach(() => {
    storedUser = { id: USER_ID, sessionVersion: SESSION_VERSION };
  });

  const run = async (authorization?: string) => {
    const req = makeRequest(authorization);
    const { next, calls } = captureNext();

    await authMiddleware(req, {} as Response, next);

    return { req, calls };
  };

  it('authenticates a token carrying the current session version', async () => {
    const { req, calls } = await run(`Bearer ${signSession()}`);

    assert.deepEqual(calls, [undefined]);
    assert.equal(req.user.id, USER_ID);
  });

  it('rejects a request without an authorization header', async () => {
    const { calls } = await run();

    assert.ok(calls[0] instanceof AuthenticationError);
  });

  it('rejects a malformed authorization header', async () => {
    const { calls } = await run(signSession());

    assert.ok(calls[0] instanceof AuthenticationError);
  });

  it('rejects an expired token', async () => {
    const token = signSession(undefined, { expiresIn: '-1s' });

    const [error] = (await run(`Bearer ${token}`)).calls;

    assert.ok(error instanceof AuthenticationError);
    assert.match(error.message, /expired/i);
  });

  it('rejects a token signed with another secret', async () => {
    const token = signSession(undefined, undefined, `${SECRET}-other`);

    const { calls } = await run(`Bearer ${token}`);

    assert.ok(calls[0] instanceof AuthenticationError);
  });

  it('rejects a token whose session version was superseded', async () => {
    storedUser = { id: USER_ID, sessionVersion: SESSION_VERSION + 1 };

    const [error] = (await run(`Bearer ${signSession()}`)).calls;

    assert.ok(error instanceof AuthenticationError);
    assert.match(error.message, /no longer active/i);
  });

  it('rejects a token whose subject no longer exists', async () => {
    storedUser = null;

    const [error] = (await run(`Bearer ${signSession()}`)).calls;

    assert.ok(error instanceof AuthenticationError);
    assert.match(error.message, /no longer active/i);
  });
});
