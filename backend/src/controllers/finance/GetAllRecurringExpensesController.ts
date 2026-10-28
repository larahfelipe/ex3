import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllRecurringExpensesService } from '@/services/finance';
import { validate } from '@/validation';
import { GetRecurringExpensesQuerySchema } from '@/validation/schema';

export class GetAllRecurringExpensesController implements Controller {
  private static INSTANCE: GetAllRecurringExpensesController;
  private readonly getAllRecurringExpensesService: GetAllRecurringExpensesService;

  private constructor(
    getAllRecurringExpensesService: GetAllRecurringExpensesService
  ) {
    this.getAllRecurringExpensesService = getAllRecurringExpensesService;
  }

  static getInstance(
    getAllRecurringExpensesService: GetAllRecurringExpensesService
  ) {
    if (!GetAllRecurringExpensesController.INSTANCE)
      GetAllRecurringExpensesController.INSTANCE =
        new GetAllRecurringExpensesController(getAllRecurringExpensesService);

    return GetAllRecurringExpensesController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(GetRecurringExpensesQuerySchema, query);

    const result = await this.getAllRecurringExpensesService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
