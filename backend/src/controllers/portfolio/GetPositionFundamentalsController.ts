import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetPositionFundamentalsService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioAssetSchema } from '@/validation/schema';

export class GetPositionFundamentalsController implements Controller {
  private static INSTANCE: GetPositionFundamentalsController;
  private readonly getPositionFundamentalsService: GetPositionFundamentalsService;

  private constructor(
    getPositionFundamentalsService: GetPositionFundamentalsService
  ) {
    this.getPositionFundamentalsService = getPositionFundamentalsService;
  }

  static getInstance(
    getPositionFundamentalsService: GetPositionFundamentalsService
  ) {
    if (!GetPositionFundamentalsController.INSTANCE)
      GetPositionFundamentalsController.INSTANCE =
        new GetPositionFundamentalsController(getPositionFundamentalsService);

    return GetPositionFundamentalsController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params, query } = req;

    const { symbol, portfolioId } = await validate(PortfolioAssetSchema, {
      symbol: params.symbol,
      portfolioId: query.portfolioId
    });

    const result = await this.getPositionFundamentalsService.execute({
      userId: user.id,
      portfolioId,
      symbol
    });

    return res.status(200).json(result);
  }
}
