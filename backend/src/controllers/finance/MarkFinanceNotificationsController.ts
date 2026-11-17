import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { MarkFinanceNotificationsService } from '@/services/finance';
import { validate } from '@/validation';
import { MarkFinanceNotificationsSchema } from '@/validation/schema';

export class MarkFinanceNotificationsController implements Controller {
  private static INSTANCE: MarkFinanceNotificationsController;
  private readonly markFinanceNotificationsService: MarkFinanceNotificationsService;

  private constructor(
    markFinanceNotificationsService: MarkFinanceNotificationsService
  ) {
    this.markFinanceNotificationsService = markFinanceNotificationsService;
  }

  static getInstance(
    markFinanceNotificationsService: MarkFinanceNotificationsService
  ) {
    if (!MarkFinanceNotificationsController.INSTANCE)
      MarkFinanceNotificationsController.INSTANCE =
        new MarkFinanceNotificationsController(markFinanceNotificationsService);

    return MarkFinanceNotificationsController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body } = req;

    const marking = await validate(MarkFinanceNotificationsSchema, body);

    const result = await this.markFinanceNotificationsService.execute({
      ...marking,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
