import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { ExpenseReadSchema } from '@/validation/schema';

export class GetExpenseController implements Controller {
  private static INSTANCE: GetExpenseController;
  private readonly getExpenseService: GetExpenseService;

  private constructor(getExpenseService: GetExpenseService) {
    this.getExpenseService = getExpenseService;
  }

  static getInstance(getExpenseService: GetExpenseService) {
    if (!GetExpenseController.INSTANCE)
      GetExpenseController.INSTANCE = new GetExpenseController(
        getExpenseService
      );

    return GetExpenseController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params, query } = req;

    const expense = await validate(ExpenseReadSchema, {
      ...query,
      id: params.id
    });

    const result = await this.getExpenseService.execute({
      ...expense,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
