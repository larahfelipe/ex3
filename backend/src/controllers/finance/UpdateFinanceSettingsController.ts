import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdateFinanceSettingsService } from '@/services/finance';
import { validate } from '@/validation';
import { UpdateFinanceSettingsSchema } from '@/validation/schema';

export class UpdateFinanceSettingsController implements Controller {
  private static INSTANCE: UpdateFinanceSettingsController;
  private readonly updateFinanceSettingsService: UpdateFinanceSettingsService;

  private constructor(
    updateFinanceSettingsService: UpdateFinanceSettingsService
  ) {
    this.updateFinanceSettingsService = updateFinanceSettingsService;
  }

  static getInstance(
    updateFinanceSettingsService: UpdateFinanceSettingsService
  ) {
    if (!UpdateFinanceSettingsController.INSTANCE)
      UpdateFinanceSettingsController.INSTANCE =
        new UpdateFinanceSettingsController(updateFinanceSettingsService);

    return UpdateFinanceSettingsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const settings = await validate(UpdateFinanceSettingsSchema, body);

    const result = await this.updateFinanceSettingsService.execute({
      ...settings,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
