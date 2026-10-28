import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { DeleteExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { ExpenseParamsSchema } from '@/validation/schema';

export class DeleteExpenseController implements Controller {
  private static INSTANCE: DeleteExpenseController;
  private readonly deleteExpenseService: DeleteExpenseService;

  private constructor(deleteExpenseService: DeleteExpenseService) {
    this.deleteExpenseService = deleteExpenseService;
  }

  static getInstance(deleteExpenseService: DeleteExpenseService) {
    if (!DeleteExpenseController.INSTANCE)
      DeleteExpenseController.INSTANCE = new DeleteExpenseController(
        deleteExpenseService
      );

    return DeleteExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params } = req;

    const { id } = await validate(ExpenseParamsSchema, params);

    const result = await this.deleteExpenseService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
