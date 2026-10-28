import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdateInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
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

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const plan = await validate(UpdateInstallmentPlanSchema, {
      ...body,
      id: params.id
    });

    const result = await this.updateInstallmentPlanService.execute({
      ...plan,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
