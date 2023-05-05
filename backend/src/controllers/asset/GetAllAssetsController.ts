import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/constants';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllAssetsService } from '@/services/asset';

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
    const { user } = req;

    try {
      const result = await this.getAllAssetsService.execute({
        userId: user.id,
        userIsStaff: user.isStaff
      });

      return res.status(200).json(result);
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
