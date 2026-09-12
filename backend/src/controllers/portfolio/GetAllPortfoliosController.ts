import type { Request, Response } from 'express';

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

    const result = await this.getAllPortfoliosService.execute({
      userIsAdmin: user.isAdmin
    });

    return res.status(200).json(result);
  }
}
