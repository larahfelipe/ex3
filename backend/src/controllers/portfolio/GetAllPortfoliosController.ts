import type { Request, Response } from 'express';

import { Errors } from '@/config';
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
        userIsAdmin: user.isAdmin
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
