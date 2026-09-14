import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioOverviewService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioScopeSchema } from '@/validation/schema';

export class GetPortfolioOverviewController implements Controller {
  private static INSTANCE: GetPortfolioOverviewController;
  private readonly getPortfolioOverviewService: GetPortfolioOverviewService;

  private constructor(
    getPortfolioOverviewService: GetPortfolioOverviewService
  ) {
    this.getPortfolioOverviewService = getPortfolioOverviewService;
  }

  static getInstance(getPortfolioOverviewService: GetPortfolioOverviewService) {
    if (!GetPortfolioOverviewController.INSTANCE)
      GetPortfolioOverviewController.INSTANCE =
        new GetPortfolioOverviewController(getPortfolioOverviewService);

    return GetPortfolioOverviewController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const { portfolioId } = await validate(PortfolioScopeSchema, query);

    const result = await this.getPortfolioOverviewService.execute({
      userId: user.id,
      portfolioId
    });

    return res.status(200).json(result);
  }
}
