import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAssetService } from '@/services/asset';
import { validate } from '@/validation';
import { GetAssetSchema } from '@/validation/schema';

export class GetAssetController implements Controller {
  private static INSTANCE: GetAssetController;
  private readonly getAssetService: GetAssetService;

  private constructor(getAssetService: GetAssetService) {
    this.getAssetService = getAssetService;
  }

  static getInstance(getAssetService: GetAssetService) {
    if (!GetAssetController.INSTANCE)
      GetAssetController.INSTANCE = new GetAssetController(getAssetService);

    return GetAssetController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params, query } = req;

    const { symbol, portfolioId } = await validate(GetAssetSchema, {
      symbol: params.symbol,
      portfolioId: query.portfolioId
    });

    const result = await this.getAssetService.execute({
      symbol,
      portfolioId,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
