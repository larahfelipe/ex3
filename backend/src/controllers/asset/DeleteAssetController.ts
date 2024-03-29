import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
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

    try {
      const { symbol } = await validate(DeleteAssetSchema, params);

      const result = await this.deleteAssetService.execute({
        symbol,
        userId: user.id
      });

      return res.status(200).json(result);
    } catch (e) {
      const {
        status = Errors.INTERNAL_SERVER_ERROR.status,
        name = Errors.INTERNAL_SERVER_ERROR.name,
        message = Errors.INTERNAL_SERVER_ERROR.message
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
