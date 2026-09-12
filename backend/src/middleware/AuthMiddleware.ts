import type { RequestHandler } from 'express';

import { envs } from '@/config';
import type { User } from '@/domain/models';
import { UnauthorizedError } from '@/errors';
import { Jwt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';

const BEARER_SCHEME = 'Bearer';

const extractBearerToken = (authorization?: string) => {
  const [scheme, token] = authorization?.split(' ') ?? [];

  return scheme === BEARER_SCHEME && token?.length ? token : null;
};

/**
 * Authentication is stateful on purpose: a signed, unexpired token grants access
 * only while its session version is still the one stored on the user row.
 * Signing in, signing out or changing the password bumps that version and
 * revokes every token issued before it.
 */
export const authMiddleware: RequestHandler = async (req, _res, next) => {
  try {
    const accessToken = extractBearerToken(req.headers.authorization);

    if (!accessToken)
      throw new UnauthorizedError('Missing or malformed authorization header');

    const jwt = Jwt.getInstance(envs.jwtSecret, envs.jwtExpirationSeconds);
    const userRepository = UserRepository.getInstance();

    const { sub, sessionVersion } = await jwt.decrypt(accessToken);

    const activeUser = await userRepository.getById(sub);

    if (!activeUser || activeUser.sessionVersion !== sessionVersion)
      throw new UnauthorizedError('Session is no longer active');

    req.user = activeUser as User;

    next();
  } catch (e) {
    next(e);
  }
};
