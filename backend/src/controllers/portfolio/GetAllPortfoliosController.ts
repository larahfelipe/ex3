import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetAllPortfoliosService } from '@/services/portfolio';

export class GetAllPortfoliosController implements Controller {
  private static INSTANCE: GetAllPortfoliosController;
  private readonly getAllPortfoliosService: GetAllPortfoliosService;

  private constructor(getAllPortfoliosService: GetAllPortfoliosService) {
    this.getAllPortfoliosService = getAllPortfoliosService;
  }

  static getInstance(getAllPortfoliosService: GetAllPortfoliosService) {
    if (!GetAllPortfoliosController.INSTANCE)
      GetAllPortfoliosController.INSTANCE = new GetAllPortfoliosController(
        getAllPortfoliosService
      );

    return GetAllPortfoliosController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user } = req;

    try {
      const result = await this.getAllPortfoliosService.execute({
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
