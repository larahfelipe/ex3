import type { Request, Response } from 'express';

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

    const { assetSymbol } = await validate(GetTransactionsParamsSchema, params);

    const result = await this.getTransactionsCountService.execute({
      assetSymbol,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
