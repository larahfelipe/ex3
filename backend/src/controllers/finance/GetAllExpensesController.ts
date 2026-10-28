import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllExpensesService } from '@/services/finance';
import { validate } from '@/validation';
import { GetExpensesQuerySchema } from '@/validation/schema';

export class GetAllExpensesController implements Controller {
  private static INSTANCE: GetAllExpensesController;
  private readonly getAllExpensesService: GetAllExpensesService;

  private constructor(getAllExpensesService: GetAllExpensesService) {
    this.getAllExpensesService = getAllExpensesService;
  }

  static getInstance(getAllExpensesService: GetAllExpensesService) {
    if (!GetAllExpensesController.INSTANCE)
      GetAllExpensesController.INSTANCE = new GetAllExpensesController(
        getAllExpensesService
      );

    return GetAllExpensesController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(GetExpensesQuerySchema, query);

    const result = await this.getAllExpensesService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
