import { Router, type Application } from 'express';

import {
  createUserControllerHandler,
  deleteUserControllerHandler,
  getAllUsersControllerHandler,
  getUserControllerHandler,
  signOutUserControllerHandler,
  updateUserControllerHandler
} from '@/controllers/user';
import { authMiddleware, authRateLimitMiddleware } from '@/middleware';

const userRouter = Router();

userRouter.post(
  '/v1/user',
  authRateLimitMiddleware,
  getUserControllerHandler as Application
);

userRouter.get(
  '/v1/users',
  authMiddleware,
  getAllUsersControllerHandler as Application
);

userRouter.post(
  '/v1/user/create',
  authRateLimitMiddleware,
  createUserControllerHandler as Application
);

userRouter.post(
  '/v1/user/sign-out',
  authMiddleware,
  signOutUserControllerHandler as Application
);

/**
 * Both routes verify the account password, so they share the sign-in limit: a
 * stolen session must not become an unthrottled password-guessing oracle.
 */
userRouter.patch(
  '/v1/user',
  authRateLimitMiddleware,
  authMiddleware,
  updateUserControllerHandler as Application
);

userRouter.delete(
  '/v1/user',
  authRateLimitMiddleware,
  authMiddleware,
  deleteUserControllerHandler as Application
);

export { userRouter };
