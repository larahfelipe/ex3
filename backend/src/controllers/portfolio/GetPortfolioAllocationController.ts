import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioAllocationService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioScopeSchema } from '@/validation/schema';

export class GetPortfolioAllocationController implements Controller {
  private static INSTANCE: GetPortfolioAllocationController;
  private readonly getPortfolioAllocationService: GetPortfolioAllocationService;

  private constructor(
    getPortfolioAllocationService: GetPortfolioAllocationService
  ) {
    this.getPortfolioAllocationService = getPortfolioAllocationService;
  }

  static getInstance(
    getPortfolioAllocationService: GetPortfolioAllocationService
  ) {
    if (!GetPortfolioAllocationController.INSTANCE)
      GetPortfolioAllocationController.INSTANCE =
        new GetPortfolioAllocationController(getPortfolioAllocationService);

    return GetPortfolioAllocationController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const { portfolioId } = await validate(PortfolioScopeSchema, query);

    const result = await this.getPortfolioAllocationService.execute({
      userId: user.id,
      portfolioId
    });

    return res.status(200).json(result);
  }
}
