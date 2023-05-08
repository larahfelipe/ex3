import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetUserService } from '@/services/user';
import { validate } from '@/validation';
import { GetUserSchema } from '@/validation/schema';

export class GetUserController implements Controller {
  private static INSTANCE: GetUserController;
  private readonly getUserService: GetUserService;

  private constructor(getUserService: GetUserService) {
    this.getUserService = getUserService;
  }

  static getInstance(getUserService: GetUserService) {
    if (!GetUserController.INSTANCE)
      GetUserController.INSTANCE = new GetUserController(getUserService);

    return GetUserController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    try {
      const { email, password } = await validate(GetUserSchema, req.body);

      const result = await this.getUserService.execute({ email, password });

      return res.status(200).json(result);
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
