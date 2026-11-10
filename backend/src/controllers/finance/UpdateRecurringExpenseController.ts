import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { UpdateRecurringExpenseService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
import { UpdateRecurringExpenseSchema } from '@/validation/schema';

export class UpdateRecurringExpenseController implements Controller {
  private static INSTANCE: UpdateRecurringExpenseController;
  private readonly updateRecurringExpenseService: UpdateRecurringExpenseService;

  private constructor(
    updateRecurringExpenseService: UpdateRecurringExpenseService
  ) {
    this.updateRecurringExpenseService = updateRecurringExpenseService;
  }

  static getInstance(
    updateRecurringExpenseService: UpdateRecurringExpenseService
  ) {
    if (!UpdateRecurringExpenseController.INSTANCE)
      UpdateRecurringExpenseController.INSTANCE =
        new UpdateRecurringExpenseController(updateRecurringExpenseService);

    return UpdateRecurringExpenseController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const series = await validate(UpdateRecurringExpenseSchema, {
      ...fieldsOf(body),
      id: params.id
    });

    const result = await this.updateRecurringExpenseService.execute({
      ...series,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
