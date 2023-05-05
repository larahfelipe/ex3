import type { Request, Response } from 'express';

import { envs } from '@/config';
import { Bcrypt, Jwt } from '@/infra/cryptography';
import { PortfolioRepository, UserRepository } from '@/infra/database';
import {
  CreateUserService,
  DeleteUserService,
  GetAllUsersService,
  GetUserService,
  UpdateUserService
} from '@/services/user';

import { CreateUserController } from './CreateUserController';
import { DeleteUserController } from './DeleteUserController';
import { GetAllUsersController } from './GetAllUsersController';
import { GetUserController } from './GetUserController';
import { UpdateUserController } from './UpdateUserController';

export const createUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const jwt = Jwt.getInstance(envs.jwtSecret);

  const createUserService = CreateUserService.getInstance(
    userRepository,
    portfolioRepository,
    jwt
  );

  const createUserController =
    CreateUserController.getInstance(createUserService);

  return createUserController.handle(req, res);
};

export const deleteUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);

  const deleteUserService = DeleteUserService.getInstance(
    userRepository,
    portfolioRepository,
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

export const getUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
  const jwt = Jwt.getInstance(envs.jwtSecret);

  const getUserService = GetUserService.getInstance(
    userRepository,
    bcrypt,
    jwt
  );

  const getUserController = GetUserController.getInstance(getUserService);

  return getUserController.handle(req, res);
};

export const updateUserControllerHandler = (req: Request, res: Response) => {
  const userRepository = UserRepository.getInstance();
  const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);

  const updateUserService = UpdateUserService.getInstance(
    userRepository,
    bcrypt
  );

  const updateUserController =
    UpdateUserController.getInstance(updateUserService);

  return updateUserController.handle(req, res);
};
