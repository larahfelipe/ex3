import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAssetValuationsService } from '@/services/asset';
import { validate } from '@/validation';
import { GetAssetValuationsSchema } from '@/validation/schema';

export class GetAssetValuationsController implements Controller {
  private static INSTANCE: GetAssetValuationsController;
  private readonly getAssetValuationsService: GetAssetValuationsService;

  private constructor(getAssetValuationsService: GetAssetValuationsService) {
    this.getAssetValuationsService = getAssetValuationsService;
  }

  static getInstance(getAssetValuationsService: GetAssetValuationsService) {
    if (!GetAssetValuationsController.INSTANCE)
      GetAssetValuationsController.INSTANCE = new GetAssetValuationsController(
        getAssetValuationsService
      );

    return GetAssetValuationsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const { portfolioId, symbols } = await validate(
      GetAssetValuationsSchema,
      query
    );

    const result = await this.getAssetValuationsService.execute({
      portfolioId,
      symbols,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
