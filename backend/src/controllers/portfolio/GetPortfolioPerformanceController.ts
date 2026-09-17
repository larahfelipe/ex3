import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioPerformanceService } from '@/services/portfolio';
import { validate } from '@/validation';
import { GetPortfolioPerformanceSchema } from '@/validation/schema';

export class GetPortfolioPerformanceController implements Controller {
  private static INSTANCE: GetPortfolioPerformanceController;
  private readonly getPortfolioPerformanceService: GetPortfolioPerformanceService;

  private constructor(
    getPortfolioPerformanceService: GetPortfolioPerformanceService
  ) {
    this.getPortfolioPerformanceService = getPortfolioPerformanceService;
  }

  static getInstance(
    getPortfolioPerformanceService: GetPortfolioPerformanceService
  ) {
    if (!GetPortfolioPerformanceController.INSTANCE)
      GetPortfolioPerformanceController.INSTANCE =
        new GetPortfolioPerformanceController(getPortfolioPerformanceService);

    return GetPortfolioPerformanceController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const { portfolioId, range, benchmark, symbol } = await validate(
      GetPortfolioPerformanceSchema,
      query
    );

    const result = await this.getPortfolioPerformanceService.execute({
      userId: user.id,
      portfolioId,
      range,
      ...(benchmark !== undefined && { benchmark }),
      ...(symbol !== undefined && { symbol })
    });

    return res.status(200).json(result);
  }
}
