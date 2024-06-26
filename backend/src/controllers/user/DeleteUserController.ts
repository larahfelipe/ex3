import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { DeleteUserService } from '@/services/user';
import { validate } from '@/validation';
import { DeleteUserSchema } from '@/validation/schema';

export class DeleteUserController implements Controller {
  private static INSTANCE: DeleteUserController;
  private readonly deleteUserService: DeleteUserService;

  private constructor(deleteUserService: DeleteUserService) {
    this.deleteUserService = deleteUserService;
  }

  static getInstance(deleteUserService: DeleteUserService) {
    if (!DeleteUserController.INSTANCE)
      DeleteUserController.INSTANCE = new DeleteUserController(
        deleteUserService
      );

    return DeleteUserController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    try {
      const { password } = await validate(DeleteUserSchema, body);

      const result = await this.deleteUserService.execute({
        user,
        password
      });

      return res.status(200).json(result);
    } catch (e) {
      const {
        status = Errors.INTERNAL_SERVER_ERROR.status,
        name = Errors.INTERNAL_SERVER_ERROR.name,
        message = Errors.INTERNAL_SERVER_ERROR.message
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
