import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllUsersService } from '@/services/user';

export class GetAllUsersController implements Controller {
  private static INSTANCE: GetAllUsersController;
  private readonly getAllUsersService: GetAllUsersService;

  private constructor(getAllUsersService: GetAllUsersService) {
    this.getAllUsersService = getAllUsersService;
  }

  static getInstance(getAllUsersService: GetAllUsersService) {
    if (!GetAllUsersController.INSTANCE)
      GetAllUsersController.INSTANCE = new GetAllUsersController(
        getAllUsersService
      );

    return GetAllUsersController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user } = req;

    try {
      const result = await this.getAllUsersService.execute({
        isAdmin: user.isAdmin
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
