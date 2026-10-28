import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetFinanceSummaryService } from '@/services/finance';
import { validate } from '@/validation';
import { FinanceSummaryQuerySchema } from '@/validation/schema';

export class GetFinanceSummaryController implements Controller {
  private static INSTANCE: GetFinanceSummaryController;
  private readonly getFinanceSummaryService: GetFinanceSummaryService;

  private constructor(getFinanceSummaryService: GetFinanceSummaryService) {
    this.getFinanceSummaryService = getFinanceSummaryService;
  }

  static getInstance(getFinanceSummaryService: GetFinanceSummaryService) {
    if (!GetFinanceSummaryController.INSTANCE)
      GetFinanceSummaryController.INSTANCE = new GetFinanceSummaryController(
        getFinanceSummaryService
      );

    return GetFinanceSummaryController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(FinanceSummaryQuerySchema, query);

    const result = await this.getFinanceSummaryService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
