import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { CancelRecurringExpenseService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
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

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const cancellation = await validate(CancelRecurringExpenseSchema, {
      ...fieldsOf(body),
      id: params.id
    });

    const result = await this.cancelRecurringExpenseService.execute({
      ...cancellation,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
