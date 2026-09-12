import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { DeleteAssetService } from '@/services/asset';
import { validate } from '@/validation';
import { DeleteAssetSchema } from '@/validation/schema';

export class DeleteAssetController implements Controller {
  private static INSTANCE: DeleteAssetController;
  private readonly deleteAssetService: DeleteAssetService;

  private constructor(deleteAssetService: DeleteAssetService) {
    this.deleteAssetService = deleteAssetService;
  }

  static getInstance(deleteAssetService: DeleteAssetService) {
    if (!DeleteAssetController.INSTANCE)
      DeleteAssetController.INSTANCE = new DeleteAssetController(
        deleteAssetService
      );

    return DeleteAssetController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params } = req;

    const { symbol } = await validate(DeleteAssetSchema, params);

    const result = await this.deleteAssetService.execute({
      symbol,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
