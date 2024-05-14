import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetTransactionsCountService } from '@/services/transaction';
import { validate } from '@/validation';
import { GetTransactionsParamsSchema } from '@/validation/schema';

export class GetTransactionsCountController implements Controller {
  private static INSTANCE: GetTransactionsCountController;
  private readonly getTransactionsCountService: GetTransactionsCountService;

  private constructor(
    getTransactionsCountService: GetTransactionsCountService
  ) {
    this.getTransactionsCountService = getTransactionsCountService;
  }

  static getInstance(getTransactionsCountService: GetTransactionsCountService) {
    if (!GetTransactionsCountController.INSTANCE)
      GetTransactionsCountController.INSTANCE =
        new GetTransactionsCountController(getTransactionsCountService);

    return GetTransactionsCountController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params } = req;

    try {
      const { assetSymbol } = await validate(
        GetTransactionsParamsSchema,
        params
      );

      const result = await this.getTransactionsCountService.execute({
        assetSymbol,
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
