import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPortfolioPositionService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioAssetSchema } from '@/validation/schema';

export class GetPortfolioPositionController implements Controller {
  private static INSTANCE: GetPortfolioPositionController;
  private readonly getPortfolioPositionService: GetPortfolioPositionService;

  private constructor(
    getPortfolioPositionService: GetPortfolioPositionService
  ) {
    this.getPortfolioPositionService = getPortfolioPositionService;
  }

  static getInstance(getPortfolioPositionService: GetPortfolioPositionService) {
    if (!GetPortfolioPositionController.INSTANCE)
      GetPortfolioPositionController.INSTANCE =
        new GetPortfolioPositionController(getPortfolioPositionService);

    return GetPortfolioPositionController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params, query } = req;

    const { symbol, portfolioId } = await validate(PortfolioAssetSchema, {
      symbol: params.symbol,
      portfolioId: query.portfolioId
    });

    const result = await this.getPortfolioPositionService.execute({
      userId: user.id,
      portfolioId,
      symbol
    });

    return res.status(200).json(result);
  }
}
