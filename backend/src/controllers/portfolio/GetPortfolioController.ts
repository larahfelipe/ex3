import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioScopeSchema } from '@/validation/schema';

export class GetPortfolioController implements Controller {
  private static INSTANCE: GetPortfolioController;
  private readonly getPortfolioService: GetPortfolioService;

  private constructor(getPortfolioService: GetPortfolioService) {
    this.getPortfolioService = getPortfolioService;
  }

  static getInstance(getPortfolioService: GetPortfolioService) {
    if (!GetPortfolioController.INSTANCE)
      GetPortfolioController.INSTANCE = new GetPortfolioController(
        getPortfolioService
      );

    return GetPortfolioController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const { portfolioId } = await validate(PortfolioScopeSchema, query);

    const result = await this.getPortfolioService.execute({
      userId: user.id,
      portfolioId
    });

    return res.status(200).json(result);
  }
}
