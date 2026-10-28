import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { RescheduleInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
import { RescheduleInstallmentPlanSchema } from '@/validation/schema';

export class RescheduleInstallmentPlanController implements Controller {
  private static INSTANCE: RescheduleInstallmentPlanController;
  private readonly rescheduleInstallmentPlanService: RescheduleInstallmentPlanService;

  private constructor(
    rescheduleInstallmentPlanService: RescheduleInstallmentPlanService
  ) {
    this.rescheduleInstallmentPlanService = rescheduleInstallmentPlanService;
  }

  static getInstance(
    rescheduleInstallmentPlanService: RescheduleInstallmentPlanService
  ) {
    if (!RescheduleInstallmentPlanController.INSTANCE)
      RescheduleInstallmentPlanController.INSTANCE =
        new RescheduleInstallmentPlanController(
          rescheduleInstallmentPlanService
        );

    return RescheduleInstallmentPlanController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const schedule = await validate(RescheduleInstallmentPlanSchema, {
      ...body,
      id: params.id
    });

    const result = await this.rescheduleInstallmentPlanService.execute({
      ...schedule,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
