import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { CreateAssetService } from '@/services/asset';
import { validate } from '@/validation';
import { CreateAssetSchema } from '@/validation/schema';

export class CreateAssetController implements Controller {
  private static INSTANCE: CreateAssetController;
  private readonly createAssetService: CreateAssetService;

  private constructor(createAssetService: CreateAssetService) {
    this.createAssetService = createAssetService;
  }

  static getInstance(createAssetService: CreateAssetService) {
    if (!CreateAssetController.INSTANCE)
      CreateAssetController.INSTANCE = new CreateAssetController(
        createAssetService
      );

    return CreateAssetController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    try {
      const { symbol } = await validate(CreateAssetSchema, body);

      const result = await this.createAssetService.execute({
        symbol,
        userId: user.id
      });

      return res.status(201).json(result);
    } catch (e) {
      const {
        status = 500,
        name = 'InternalServerError',
        message = DefaultErrorMessages.INTERNAL_SERVER_ERROR
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
