import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/constants';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { CreateUserService } from '@/services/user';
import { validate } from '@/validation';
import { CreateUserSchema } from '@/validation/schema';

export class CreateUserController implements Controller {
  private static INSTANCE: CreateUserController;
  private readonly createUserService: CreateUserService;

  private constructor(createUserService: CreateUserService) {
    this.createUserService = createUserService;
  }

  static getInstance(createUserService: CreateUserService) {
    if (!CreateUserController.INSTANCE)
      CreateUserController.INSTANCE = new CreateUserController(
        createUserService
      );

    return CreateUserController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    try {
      const { name, email, password } = await validate(
        CreateUserSchema,
        req.body
      );

      const result = await this.createUserService.execute({
        email,
        password,
        name: name as string
      });

      return res.status(201).json(result);
    } catch (e) {
      const {
        status = 500,
        name = 'InternalServerError',
        message = DefaultErrorMessages.INTERNAL_SERVER_ERROR
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
