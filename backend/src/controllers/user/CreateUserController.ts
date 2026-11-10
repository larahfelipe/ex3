import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
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

  async handle(req: ControllerRequest, res: Response) {
    const {
      firstName,
      lastName,
      email,
      password,
      baseCurrency,
      portfolioName
    } = await validate(CreateUserSchema, req.body);

    const result = await this.createUserService.execute({
      firstName,
      lastName,
      email,
      password,
      baseCurrency,
      portfolioName
    });

    return res.status(201).json(result);
  }
}
