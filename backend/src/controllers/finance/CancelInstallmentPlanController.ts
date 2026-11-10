import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { CancelInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
import { InstallmentPlanParamsSchema } from '@/validation/schema';

export class CancelInstallmentPlanController implements Controller {
  private static INSTANCE: CancelInstallmentPlanController;
  private readonly cancelInstallmentPlanService: CancelInstallmentPlanService;

  private constructor(
    cancelInstallmentPlanService: CancelInstallmentPlanService
  ) {
    this.cancelInstallmentPlanService = cancelInstallmentPlanService;
  }

  static getInstance(
    cancelInstallmentPlanService: CancelInstallmentPlanService
  ) {
    if (!CancelInstallmentPlanController.INSTANCE)
      CancelInstallmentPlanController.INSTANCE =
        new CancelInstallmentPlanController(cancelInstallmentPlanService);

    return CancelInstallmentPlanController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(InstallmentPlanParamsSchema, params);

    const result = await this.cancelInstallmentPlanService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
