import { Router, type Application } from 'express';

import {
  CreateUserControllerHandler,
  DeleteUserControllerHandler,
  GetAllUsersControllerHandler,
  GetUserControllerHandler,
  UpdateUserControllerHandler
} from '@/controllers/user';
import { authMiddleware } from '@/middleware';

const userRouter = Router();

userRouter.get('/v1/user', GetUserControllerHandler as Application);

userRouter.get(
  '/v1/user/all',
  authMiddleware as Application,
  GetAllUsersControllerHandler as Application
);

userRouter.post('/v1/user', CreateUserControllerHandler as Application);

userRouter.put(
  '/v1/user',
  authMiddleware as Application,
  UpdateUserControllerHandler as Application
);

userRouter.delete(
  '/v1/user',
  authMiddleware as Application,
  DeleteUserControllerHandler as Application
);

export { userRouter };
