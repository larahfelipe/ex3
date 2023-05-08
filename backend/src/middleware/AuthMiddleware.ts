import type { NextFunction, Request, Response } from 'express';

import { DefaultErrorMessages, UserMessages, envs } from '@/config';
import type { User } from '@/domain/models';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  type ApplicationError
} from '@/errors';
import { Jwt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { authorization } = req.headers;

  try {
    if (!authorization?.length)
      throw new UnauthorizedError(DefaultErrorMessages.INVALID_AUTH_HEADER);

    const [_, accessToken] = authorization.split(' ');

    const jwt = Jwt.getInstance(envs.jwtSecret);
    const userRepository = UserRepository.getInstance();

    const { id: decryptedAccessToken } = await jwt.decrypt(accessToken);

    if (!decryptedAccessToken)
      throw new BadRequestError(DefaultErrorMessages.INVALID_TOKEN);

    const userExists = await userRepository.getByAccessToken(accessToken);

    if (!userExists) throw new NotFoundError(UserMessages.NOT_FOUND);

    req.user = userExists as User;

    return next();
  } catch (e) {
    const { status, name, message } = e as ApplicationError;

    return res.status(status).json({ name, message });
  }
};
