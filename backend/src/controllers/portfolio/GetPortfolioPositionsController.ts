import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioPositionsService } from '@/services/portfolio';
import { validate } from '@/validation';
import { GetPortfolioPositionsSchema } from '@/validation/schema';

export class GetPortfolioPositionsController implements Controller {
  private static INSTANCE: GetPortfolioPositionsController;
  private readonly getPortfolioPositionsService: GetPortfolioPositionsService;

  private constructor(
    getPortfolioPositionsService: GetPortfolioPositionsService
  ) {
    this.getPortfolioPositionsService = getPortfolioPositionsService;
  }

  static getInstance(
    getPortfolioPositionsService: GetPortfolioPositionsService
  ) {
    if (!GetPortfolioPositionsController.INSTANCE)
      GetPortfolioPositionsController.INSTANCE =
        new GetPortfolioPositionsController(getPortfolioPositionsService);

    return GetPortfolioPositionsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const {
      portfolioId,
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      type,
      status
    } = await validate(GetPortfolioPositionsSchema, query);

    const result = await this.getPortfolioPositionsService.execute({
      userId: user.id,
      portfolioId,
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
      type,
      status
    });

    return res.status(200).json(result);
  }
}
