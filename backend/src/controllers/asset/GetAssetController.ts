import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
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
    const { user, params } = req;

    try {
      const { symbol } = await validate(GetAssetSchema, params);

      const result = await this.getAssetService.execute({
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
