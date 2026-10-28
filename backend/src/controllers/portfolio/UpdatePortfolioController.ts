import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdatePortfolioService } from '@/services/portfolio';
import { validate } from '@/validation';
import { UpdatePortfolioSchema } from '@/validation/schema';

export class UpdatePortfolioController implements Controller {
  private static INSTANCE: UpdatePortfolioController;
  private readonly updatePortfolioService: UpdatePortfolioService;

  private constructor(updatePortfolioService: UpdatePortfolioService) {
    this.updatePortfolioService = updatePortfolioService;
  }

  static getInstance(updatePortfolioService: UpdatePortfolioService) {
    if (!UpdatePortfolioController.INSTANCE)
      UpdatePortfolioController.INSTANCE = new UpdatePortfolioController(
        updatePortfolioService
      );

    return UpdatePortfolioController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const { portfolioId, name, baseCurrency } = await validate(
      UpdatePortfolioSchema,
      body
    );

    const result = await this.updatePortfolioService.execute({
      userId: user.id,
      portfolioId,
      name,
      baseCurrency
    });

    return res.status(200).json(result);
  }
}
