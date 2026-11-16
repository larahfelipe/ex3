import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetAllCreditCardsService } from '@/services/finance';

export class GetAllCreditCardsController implements Controller {
  private static INSTANCE: GetAllCreditCardsController;
  private readonly getAllCreditCardsService: GetAllCreditCardsService;

  private constructor(getAllCreditCardsService: GetAllCreditCardsService) {
    this.getAllCreditCardsService = getAllCreditCardsService;
  }

  static getInstance(getAllCreditCardsService: GetAllCreditCardsService) {
    if (!GetAllCreditCardsController.INSTANCE)
      GetAllCreditCardsController.INSTANCE = new GetAllCreditCardsController(
        getAllCreditCardsService
      );

    return GetAllCreditCardsController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user } = req;

    const result = await this.getAllCreditCardsService.execute({
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
