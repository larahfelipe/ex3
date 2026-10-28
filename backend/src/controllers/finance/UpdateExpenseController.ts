import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdateExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { UpdateExpenseSchema } from '@/validation/schema';

export class UpdateExpenseController implements Controller {
  private static INSTANCE: UpdateExpenseController;
  private readonly updateExpenseService: UpdateExpenseService;

  private constructor(updateExpenseService: UpdateExpenseService) {
    this.updateExpenseService = updateExpenseService;
  }

  static getInstance(updateExpenseService: UpdateExpenseService) {
    if (!UpdateExpenseController.INSTANCE)
      UpdateExpenseController.INSTANCE = new UpdateExpenseController(
        updateExpenseService
      );

    return UpdateExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const expense = await validate(UpdateExpenseSchema, {
      ...body,
      id: params.id
    });

    const result = await this.updateExpenseService.execute({
      ...expense,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
