import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetTransactionsCountService } from '@/services/transaction';
import { validate } from '@/validation';
import {
  GetTransactionsParamsSchema,
  PortfolioScopeSchema
} from '@/validation/schema';

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
    const { user, params, query } = req;

    const [{ assetSymbol }, { portfolioId }] = await Promise.all([
      validate(GetTransactionsParamsSchema, params),
      validate(PortfolioScopeSchema, query)
    ]);

    const result = await this.getTransactionsCountService.execute({
      assetSymbol,
      portfolioId,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
