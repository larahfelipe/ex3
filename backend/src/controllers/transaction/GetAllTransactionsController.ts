import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllTransactionsService } from '@/services/transaction';
import { validate } from '@/validation';
import { GetTransactionsSchema } from '@/validation/schema';

export class GetAllTransactionsController implements Controller {
  private static INSTANCE: GetAllTransactionsController;
  private readonly getAllTransactionsService: GetAllTransactionsService;

  private constructor(getAllTransactionsService: GetAllTransactionsService) {
    this.getAllTransactionsService = getAllTransactionsService;
  }

  static getInstance(getAllTransactionsService: GetAllTransactionsService) {
    if (!GetAllTransactionsController.INSTANCE)
      GetAllTransactionsController.INSTANCE = new GetAllTransactionsController(
        getAllTransactionsService
      );

    return GetAllTransactionsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params } = req;

    try {
      const { assetId } = await validate(GetTransactionsSchema, params);

      const result = await this.getAllTransactionsService.execute({
        assetId,
        userId: user.id,
        userIsStaff: user.isStaff
      });

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
