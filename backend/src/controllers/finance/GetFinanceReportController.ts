import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetFinanceReportService } from '@/services/finance';
import { validate } from '@/validation';
import { FinanceReportQuerySchema } from '@/validation/schema';

export class GetFinanceReportController implements Controller {
  private static INSTANCE: GetFinanceReportController;
  private readonly getFinanceReportService: GetFinanceReportService;

  private constructor(getFinanceReportService: GetFinanceReportService) {
    this.getFinanceReportService = getFinanceReportService;
  }

  static getInstance(getFinanceReportService: GetFinanceReportService) {
    if (!GetFinanceReportController.INSTANCE)
      GetFinanceReportController.INSTANCE = new GetFinanceReportController(
        getFinanceReportService
      );

    return GetFinanceReportController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(FinanceReportQuerySchema, query);

    const result = await this.getFinanceReportService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
