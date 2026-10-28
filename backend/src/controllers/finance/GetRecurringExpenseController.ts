import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetRecurringExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { RecurringExpenseReadSchema } from '@/validation/schema';

export class GetRecurringExpenseController implements Controller {
  private static INSTANCE: GetRecurringExpenseController;
  private readonly getRecurringExpenseService: GetRecurringExpenseService;

  private constructor(getRecurringExpenseService: GetRecurringExpenseService) {
    this.getRecurringExpenseService = getRecurringExpenseService;
  }

  static getInstance(getRecurringExpenseService: GetRecurringExpenseService) {
    if (!GetRecurringExpenseController.INSTANCE)
      GetRecurringExpenseController.INSTANCE =
        new GetRecurringExpenseController(getRecurringExpenseService);

    return GetRecurringExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params, query } = req;

    const series = await validate(RecurringExpenseReadSchema, {
      ...query,
      id: params.id
    });

    const result = await this.getRecurringExpenseService.execute({
      ...series,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
