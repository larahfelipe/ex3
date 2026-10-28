import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllInstallmentPlansService } from '@/services/finance';
import { validate } from '@/validation';
import { GetInstallmentPlansQuerySchema } from '@/validation/schema';

export class GetAllInstallmentPlansController implements Controller {
  private static INSTANCE: GetAllInstallmentPlansController;
  private readonly getAllInstallmentPlansService: GetAllInstallmentPlansService;

  private constructor(
    getAllInstallmentPlansService: GetAllInstallmentPlansService
  ) {
    this.getAllInstallmentPlansService = getAllInstallmentPlansService;
  }

  static getInstance(
    getAllInstallmentPlansService: GetAllInstallmentPlansService
  ) {
    if (!GetAllInstallmentPlansController.INSTANCE)
      GetAllInstallmentPlansController.INSTANCE =
        new GetAllInstallmentPlansController(getAllInstallmentPlansService);

    return GetAllInstallmentPlansController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(GetInstallmentPlansQuerySchema, query);

    const result = await this.getAllInstallmentPlansService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
