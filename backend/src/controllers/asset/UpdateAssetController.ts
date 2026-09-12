import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdateAssetService } from '@/services/asset';
import { validate } from '@/validation';
import { UpdateAssetSchema } from '@/validation/schema';

export class UpdateAssetController implements Controller {
  private static INSTANCE: UpdateAssetController;
  private readonly updateAssetService: UpdateAssetService;

  private constructor(updateAssetService: UpdateAssetService) {
    this.updateAssetService = updateAssetService;
  }

  static getInstance(updateAssetService: UpdateAssetService) {
    if (!UpdateAssetController.INSTANCE)
      UpdateAssetController.INSTANCE = new UpdateAssetController(
        updateAssetService
      );

    return UpdateAssetController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const { oldSymbol, newSymbol } = await validate(UpdateAssetSchema, {
      oldSymbol: params.symbol,
      newSymbol: body.newSymbol
    });

    const result = await this.updateAssetService.execute({
      oldSymbol,
      newSymbol,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
