import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetPositionIndicatorsService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioAssetSchema } from '@/validation/schema';

export class GetPositionIndicatorsController implements Controller {
  private static INSTANCE: GetPositionIndicatorsController;
  private readonly getPositionIndicatorsService: GetPositionIndicatorsService;

  private constructor(
    getPositionIndicatorsService: GetPositionIndicatorsService
  ) {
    this.getPositionIndicatorsService = getPositionIndicatorsService;
  }

  static getInstance(
    getPositionIndicatorsService: GetPositionIndicatorsService
  ) {
    if (!GetPositionIndicatorsController.INSTANCE)
      GetPositionIndicatorsController.INSTANCE =
        new GetPositionIndicatorsController(getPositionIndicatorsService);

    return GetPositionIndicatorsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params, query } = req;

    const { symbol, portfolioId } = await validate(PortfolioAssetSchema, {
      symbol: params.symbol,
      portfolioId: query.portfolioId
    });

    const result = await this.getPositionIndicatorsService.execute({
      userId: user.id,
      portfolioId,
      symbol
    });

    return res.status(200).json(result);
  }
}
