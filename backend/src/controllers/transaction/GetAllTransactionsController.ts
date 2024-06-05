import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllTransactionsService } from '@/services/transaction';
import { validate } from '@/validation';
import {
  GetTransactionsParamsSchema,
  GetTransactionsQuerySchema
} from '@/validation/schema';

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
    const { user, params, query } = req;

    try {
      const [{ assetSymbol }, { page, limit, lastId }] = await Promise.all([
        validate(GetTransactionsParamsSchema, params),
        validate(GetTransactionsQuerySchema, query)
      ]);

      const result = await this.getAllTransactionsService.execute({
        assetSymbol,
        page,
        limit,
        lastId,
        userId: user.id
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
