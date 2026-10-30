import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { DeletePortfolioService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioScopeSchema } from '@/validation/schema';

export class DeletePortfolioController implements Controller {
  private static INSTANCE: DeletePortfolioController;
  private readonly deletePortfolioService: DeletePortfolioService;

  private constructor(deletePortfolioService: DeletePortfolioService) {
    this.deletePortfolioService = deletePortfolioService;
  }

  static getInstance(deletePortfolioService: DeletePortfolioService) {
    if (!DeletePortfolioController.INSTANCE)
      DeletePortfolioController.INSTANCE = new DeletePortfolioController(
        deletePortfolioService
      );

    return DeletePortfolioController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, query } = req;

    const { portfolioId } = await validate(PortfolioScopeSchema, query);

    const result = await this.deletePortfolioService.execute({
      userId: user.id,
      portfolioId
    });

    return res.status(200).json(result);
  }
}
