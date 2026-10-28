import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetFinanceAlertsService } from '@/services/finance';
import { validate } from '@/validation';
import { FinanceAlertsQuerySchema } from '@/validation/schema';

export class GetFinanceAlertsController implements Controller {
  private static INSTANCE: GetFinanceAlertsController;
  private readonly getFinanceAlertsService: GetFinanceAlertsService;

  private constructor(getFinanceAlertsService: GetFinanceAlertsService) {
    this.getFinanceAlertsService = getFinanceAlertsService;
  }

  static getInstance(getFinanceAlertsService: GetFinanceAlertsService) {
    if (!GetFinanceAlertsController.INSTANCE)
      GetFinanceAlertsController.INSTANCE = new GetFinanceAlertsController(
        getFinanceAlertsService
      );

    return GetFinanceAlertsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(FinanceAlertsQuerySchema, query);

    const result = await this.getFinanceAlertsService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
