import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetFinanceSettingsService } from '@/services/finance';

export class GetFinanceSettingsController implements Controller {
  private static INSTANCE: GetFinanceSettingsController;
  private readonly getFinanceSettingsService: GetFinanceSettingsService;

  private constructor(getFinanceSettingsService: GetFinanceSettingsService) {
    this.getFinanceSettingsService = getFinanceSettingsService;
  }

  static getInstance(getFinanceSettingsService: GetFinanceSettingsService) {
    if (!GetFinanceSettingsController.INSTANCE)
      GetFinanceSettingsController.INSTANCE = new GetFinanceSettingsController(
        getFinanceSettingsService
      );

    return GetFinanceSettingsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user } = req;

    const result = await this.getFinanceSettingsService.execute({
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
