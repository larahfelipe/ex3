import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { UpdateInstallmentPlanService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
import { UpdateInstallmentPlanSchema } from '@/validation/schema';

export class UpdateInstallmentPlanController implements Controller {
  private static INSTANCE: UpdateInstallmentPlanController;
  private readonly updateInstallmentPlanService: UpdateInstallmentPlanService;

  private constructor(
    updateInstallmentPlanService: UpdateInstallmentPlanService
  ) {
    this.updateInstallmentPlanService = updateInstallmentPlanService;
  }

  static getInstance(
    updateInstallmentPlanService: UpdateInstallmentPlanService
  ) {
    if (!UpdateInstallmentPlanController.INSTANCE)
      UpdateInstallmentPlanController.INSTANCE =
        new UpdateInstallmentPlanController(updateInstallmentPlanService);

    return UpdateInstallmentPlanController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const plan = await validate(UpdateInstallmentPlanSchema, {
      ...fieldsOf(body),
      id: params.id
    });

    const result = await this.updateInstallmentPlanService.execute({
      ...plan,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
