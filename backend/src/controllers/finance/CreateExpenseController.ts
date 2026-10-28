import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CreateExpenseService } from '@/services/finance';
import { validate } from '@/validation';
import { CreateExpenseSchema } from '@/validation/schema';

export class CreateExpenseController implements Controller {
  private static INSTANCE: CreateExpenseController;
  private readonly createExpenseService: CreateExpenseService;

  private constructor(createExpenseService: CreateExpenseService) {
    this.createExpenseService = createExpenseService;
  }

  static getInstance(createExpenseService: CreateExpenseService) {
    if (!CreateExpenseController.INSTANCE)
      CreateExpenseController.INSTANCE = new CreateExpenseController(
        createExpenseService
      );

    return CreateExpenseController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const expense = await validate(CreateExpenseSchema, body);

    const result = await this.createExpenseService.execute({
      ...expense,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
