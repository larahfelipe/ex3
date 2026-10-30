import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { RescheduleInstallmentPlanService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
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

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const schedule = await validate(RescheduleInstallmentPlanSchema, {
      ...fieldsOf(body),
      id: params.id
    });

    const result = await this.rescheduleInstallmentPlanService.execute({
      ...schedule,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
