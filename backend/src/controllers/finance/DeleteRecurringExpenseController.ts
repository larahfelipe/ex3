import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { DeleteRecurringExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { RecurringExpenseParamsSchema } from '@/validation/schema';

export class DeleteRecurringExpenseController implements Controller {
  private static INSTANCE: DeleteRecurringExpenseController;
  private readonly deleteRecurringExpenseService: DeleteRecurringExpenseService;

  private constructor(
    deleteRecurringExpenseService: DeleteRecurringExpenseService
  ) {
    this.deleteRecurringExpenseService = deleteRecurringExpenseService;
  }

  static getInstance(
    deleteRecurringExpenseService: DeleteRecurringExpenseService
  ) {
    if (!DeleteRecurringExpenseController.INSTANCE)
      DeleteRecurringExpenseController.INSTANCE =
        new DeleteRecurringExpenseController(deleteRecurringExpenseService);

    return DeleteRecurringExpenseController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(RecurringExpenseParamsSchema, params);

    const result = await this.deleteRecurringExpenseService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
