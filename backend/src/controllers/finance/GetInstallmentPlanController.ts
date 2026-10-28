import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
import { InstallmentPlanReadSchema } from '@/validation/schema';

export class GetInstallmentPlanController implements Controller {
  private static INSTANCE: GetInstallmentPlanController;
  private readonly getInstallmentPlanService: GetInstallmentPlanService;

  private constructor(getInstallmentPlanService: GetInstallmentPlanService) {
    this.getInstallmentPlanService = getInstallmentPlanService;
  }

  static getInstance(getInstallmentPlanService: GetInstallmentPlanService) {
    if (!GetInstallmentPlanController.INSTANCE)
      GetInstallmentPlanController.INSTANCE = new GetInstallmentPlanController(
        getInstallmentPlanService
      );

    return GetInstallmentPlanController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params, query } = req;

    const plan = await validate(InstallmentPlanReadSchema, {
      ...query,
      id: params.id
    });

    const result = await this.getInstallmentPlanService.execute({
      ...plan,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
