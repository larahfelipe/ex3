import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { GetPortfolioService } from '@/services/portfolio';

export class GetPortfolioController implements Controller {
  private static INSTANCE: GetPortfolioController;
  private readonly getPortfolioService: GetPortfolioService;

  private constructor(getPortfolioService: GetPortfolioService) {
    this.getPortfolioService = getPortfolioService;
  }

  static getInstance(getPortfolioService: GetPortfolioService) {
    if (!GetPortfolioController.INSTANCE)
      GetPortfolioController.INSTANCE = new GetPortfolioController(
        getPortfolioService
      );

    return GetPortfolioController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user } = req;

    try {
      const result = await this.getPortfolioService.execute({
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
