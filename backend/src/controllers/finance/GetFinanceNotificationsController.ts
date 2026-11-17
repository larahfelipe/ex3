import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetFinanceNotificationsService } from '@/services/finance';
import { validate } from '@/validation';
import { FinanceNotificationsQuerySchema } from '@/validation/schema';

export class GetFinanceNotificationsController implements Controller {
  private static INSTANCE: GetFinanceNotificationsController;
  private readonly getFinanceNotificationsService: GetFinanceNotificationsService;

  private constructor(
    getFinanceNotificationsService: GetFinanceNotificationsService
  ) {
    this.getFinanceNotificationsService = getFinanceNotificationsService;
  }

  static getInstance(
    getFinanceNotificationsService: GetFinanceNotificationsService
  ) {
    if (!GetFinanceNotificationsController.INSTANCE)
      GetFinanceNotificationsController.INSTANCE =
        new GetFinanceNotificationsController(getFinanceNotificationsService);

    return GetFinanceNotificationsController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, query } = req;

    const filters = await validate(FinanceNotificationsQuerySchema, query);

    const result = await this.getFinanceNotificationsService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
