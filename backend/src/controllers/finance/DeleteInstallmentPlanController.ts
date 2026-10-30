import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { DeleteInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
import { InstallmentPlanParamsSchema } from '@/validation/schema';

export class DeleteInstallmentPlanController implements Controller {
  private static INSTANCE: DeleteInstallmentPlanController;
  private readonly deleteInstallmentPlanService: DeleteInstallmentPlanService;

  private constructor(
    deleteInstallmentPlanService: DeleteInstallmentPlanService
  ) {
    this.deleteInstallmentPlanService = deleteInstallmentPlanService;
  }

  static getInstance(
    deleteInstallmentPlanService: DeleteInstallmentPlanService
  ) {
    if (!DeleteInstallmentPlanController.INSTANCE)
      DeleteInstallmentPlanController.INSTANCE =
        new DeleteInstallmentPlanController(deleteInstallmentPlanService);

    return DeleteInstallmentPlanController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(InstallmentPlanParamsSchema, params);

    const result = await this.deleteInstallmentPlanService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
