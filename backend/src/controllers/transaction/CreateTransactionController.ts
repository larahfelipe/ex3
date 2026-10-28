import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CreateTransactionService } from '@/services/transaction';
import { validate } from '@/validation';
import { CreateTransactionSchema } from '@/validation/schema';

export class CreateTransactionController implements Controller {
  private static INSTANCE: CreateTransactionController;
  private readonly createTransactionService: CreateTransactionService;

  private constructor(createTransactionService: CreateTransactionService) {
    this.createTransactionService = createTransactionService;
  }

  static getInstance(createTransactionService: CreateTransactionService) {
    if (!CreateTransactionController.INSTANCE)
      CreateTransactionController.INSTANCE = new CreateTransactionController(
        createTransactionService
      );

    return CreateTransactionController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const transaction = await validate(CreateTransactionSchema, body);

    const result = await this.createTransactionService.execute({
      ...transaction,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
