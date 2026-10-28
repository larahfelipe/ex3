import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CreateRecurringExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { CreateRecurringExpenseSchema } from '@/validation/schema';

export class CreateRecurringExpenseController implements Controller {
  private static INSTANCE: CreateRecurringExpenseController;
  private readonly createRecurringExpenseService: CreateRecurringExpenseService;

  private constructor(
    createRecurringExpenseService: CreateRecurringExpenseService
  ) {
    this.createRecurringExpenseService = createRecurringExpenseService;
  }

  static getInstance(
    createRecurringExpenseService: CreateRecurringExpenseService
  ) {
    if (!CreateRecurringExpenseController.INSTANCE)
      CreateRecurringExpenseController.INSTANCE =
        new CreateRecurringExpenseController(createRecurringExpenseService);

    return CreateRecurringExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const series = await validate(CreateRecurringExpenseSchema, body);

    const result = await this.createRecurringExpenseService.execute({
      ...series,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
