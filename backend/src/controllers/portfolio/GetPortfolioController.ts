import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioService } from '@/services/portfolio';

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
    const { user } = req;

    const result = await this.getPortfolioService.execute({
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
