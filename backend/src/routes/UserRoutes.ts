import { Router, type Application } from 'express';

import {
  createUserControllerHandler,
  deleteUserControllerHandler,
  getAllUsersControllerHandler,
  getCurrentUserControllerHandler,
  getUserControllerHandler,
  signOutUserControllerHandler,
  updateUserControllerHandler
} from '@/controllers/user';
import {
  accountChangeRateLimitMiddleware,
  authMiddleware,
  signInRateLimitMiddleware,
  signUpRateLimitMiddleware
} from '@/middleware';

const userRouter = Router();

userRouter.post(
  '/v1/user',
  signInRateLimitMiddleware,
  getUserControllerHandler as Application
);

userRouter.get(
  '/v1/user',
  authMiddleware,
  getCurrentUserControllerHandler as Application
);

userRouter.get(
  '/v1/users',
  authMiddleware,
  getAllUsersControllerHandler as Application
);

userRouter.post(
  '/v1/user/create',
  signUpRateLimitMiddleware,
  createUserControllerHandler as Application
);

userRouter.post(
  '/v1/user/sign-out',
  authMiddleware,
  signOutUserControllerHandler as Application
);

/**
 * Both routes verify the account password, so they are throttled like sign-in:
 * a stolen session must not become an unthrottled password-guessing oracle.
 */
userRouter.patch(
  '/v1/user',
  accountChangeRateLimitMiddleware,
  authMiddleware,
  updateUserControllerHandler as Application
);

userRouter.delete(
  '/v1/user',
  accountChangeRateLimitMiddleware,
  authMiddleware,
  deleteUserControllerHandler as Application
);

export { userRouter };
