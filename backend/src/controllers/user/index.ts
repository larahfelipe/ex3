import type { Request, Response } from 'express';

import { envs } from '@/config';
import { Bcrypt, Jwt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';
import {
  CreateUserService,
  DeleteUserService,
  GetAllUsersService,
  GetCurrentUserService,
  GetUserService,
  SignOutUserService,
  UpdateUserService
} from '@/services/user';

import { CreateUserController } from './CreateUserController';
import { DeleteUserController } from './DeleteUserController';
import { GetAllUsersController } from './GetAllUsersController';
import { GetCurrentUserController } from './GetCurrentUserController';
import { GetUserController } from './GetUserController';
import { SignOutUserController } from './SignOutUserController';
import { UpdateUserController } from './UpdateUserController';

export const createUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const jwt = Jwt.getInstance(envs.jwtSecret, envs.jwtExpirationSeconds);

  const createUserService = CreateUserService.getInstance(userRepository, jwt);

  const createUserController =
    CreateUserController.getInstance(createUserService);

  return createUserController.handle(req, res);
};

export const deleteUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(envs.bcryptSalt);

  const deleteUserService = DeleteUserService.getInstance(
    userRepository,
    bcrypt
  );

  const deleteUserController =
    DeleteUserController.getInstance(deleteUserService);

  return deleteUserController.handle(req, res);
};

export const getAllUsersControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();

  const getAllUsersService = GetAllUsersService.getInstance(userRepository);

  const getAllUsersController =
    GetAllUsersController.getInstance(getAllUsersService);

  return getAllUsersController.handle(req, res);
};

export const getCurrentUserControllerHandler = (
  req: Request,
  res: Response
) => {
  const userRepository = UserRepository.getInstance();

  const getCurrentUserService =
    GetCurrentUserService.getInstance(userRepository);

  const getCurrentUserController = GetCurrentUserController.getInstance(
    getCurrentUserService
  );

  return getCurrentUserController.handle(req, res);
};

export const getUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(envs.bcryptSalt);
  const jwt = Jwt.getInstance(envs.jwtSecret, envs.jwtExpirationSeconds);

  const getUserService = GetUserService.getInstance(
    userRepository,
    bcrypt,
    jwt
  );

  const getUserController = GetUserController.getInstance(getUserService);

  return getUserController.handle(req, res);
};

export const signOutUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();

  const signOutUserService = SignOutUserService.getInstance(userRepository);

  const signOutUserController =
    SignOutUserController.getInstance(signOutUserService);

  return signOutUserController.handle(req, res);
};

export const updateUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(envs.bcryptSalt);

  const updateUserService = UpdateUserService.getInstance(
    userRepository,
    bcrypt
  );

  const updateUserController =
    UpdateUserController.getInstance(updateUserService);

  return updateUserController.handle(req, res);
};
