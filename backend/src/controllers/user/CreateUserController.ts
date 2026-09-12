import type { Request, Response } from 'express';

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
  }
}
