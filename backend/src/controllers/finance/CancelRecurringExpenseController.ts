import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CancelRecurringExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { CancelRecurringExpenseSchema } from '@/validation/schema';

export class CancelRecurringExpenseController implements Controller {
  private static INSTANCE: CancelRecurringExpenseController;
  private readonly cancelRecurringExpenseService: CancelRecurringExpenseService;

  private constructor(
    cancelRecurringExpenseService: CancelRecurringExpenseService
  ) {
    this.cancelRecurringExpenseService = cancelRecurringExpenseService;
  }

  static getInstance(
    cancelRecurringExpenseService: CancelRecurringExpenseService
  ) {
    if (!CancelRecurringExpenseController.INSTANCE)
      CancelRecurringExpenseController.INSTANCE =
        new CancelRecurringExpenseController(cancelRecurringExpenseService);

    return CancelRecurringExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const cancellation = await validate(CancelRecurringExpenseSchema, {
      ...body,
      id: params.id
    });

    const result = await this.cancelRecurringExpenseService.execute({
      ...cancellation,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
