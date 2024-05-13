import type { Request, Response } from 'express';

import { Errors, type SortOrderTypes } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllAssetsService } from '@/services/asset';
import { validate } from '@/validation';
import { GetAssetsSchema } from '@/validation/schema';

export class GetAllAssetsController implements Controller {
  private static INSTANCE: GetAllAssetsController;
  private readonly getAllAssetsService: GetAllAssetsService;

  private constructor(getAllAssetsService: GetAllAssetsService) {
    this.getAllAssetsService = getAllAssetsService;
  }

  static getInstance(getAllAssetsService: GetAllAssetsService) {
    if (!GetAllAssetsController.INSTANCE)
      GetAllAssetsController.INSTANCE = new GetAllAssetsController(
        getAllAssetsService
      );

    return GetAllAssetsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    try {
      const { page, limit, sort } = await validate(GetAssetsSchema, query);

      const result = await this.getAllAssetsService.execute({
        page,
        limit,
        userId: user.id,
        sort: sort as (typeof SortOrderTypes)[keyof typeof SortOrderTypes]
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
