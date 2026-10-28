import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CreateInstallmentPlanService } from '@/services/finance';
import { validate } from '@/validation';
import { CreateInstallmentPlanSchema } from '@/validation/schema';

export class CreateInstallmentPlanController implements Controller {
  private static INSTANCE: CreateInstallmentPlanController;
  private readonly createInstallmentPlanService: CreateInstallmentPlanService;

  private constructor(
    createInstallmentPlanService: CreateInstallmentPlanService
  ) {
    this.createInstallmentPlanService = createInstallmentPlanService;
  }

  static getInstance(
    createInstallmentPlanService: CreateInstallmentPlanService
  ) {
    if (!CreateInstallmentPlanController.INSTANCE)
      CreateInstallmentPlanController.INSTANCE =
        new CreateInstallmentPlanController(createInstallmentPlanService);

    return CreateInstallmentPlanController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const plan = await validate(CreateInstallmentPlanSchema, body);

    const result = await this.createInstallmentPlanService.execute({
      ...plan,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
