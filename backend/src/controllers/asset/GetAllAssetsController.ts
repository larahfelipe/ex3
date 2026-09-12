import type { Request, Response } from 'express';

import { type SortOrderTypes } from '@/config';
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

    const { page, limit, sort, portfolioId } = await validate(
      GetAssetsSchema,
      query
    );

    const result = await this.getAllAssetsService.execute({
      page,
      limit,
      portfolioId,
      userId: user.id,
      sort: sort as (typeof SortOrderTypes)[keyof typeof SortOrderTypes]
    });

    return res.status(200).json(result);
  }
}
