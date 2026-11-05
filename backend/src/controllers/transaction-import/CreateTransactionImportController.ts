import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { CreateTransactionImportService } from '@/services/transaction-import';
import { validate } from '@/validation';
import { CreateTransactionImportSchema } from '@/validation/schema';

export class CreateTransactionImportController implements Controller {
  private static INSTANCE: CreateTransactionImportController;
  private readonly createTransactionImportService: CreateTransactionImportService;

  private constructor(
    createTransactionImportService: CreateTransactionImportService
  ) {
    this.createTransactionImportService = createTransactionImportService;
  }

  static getInstance(
    createTransactionImportService: CreateTransactionImportService
  ) {
    if (!CreateTransactionImportController.INSTANCE)
      CreateTransactionImportController.INSTANCE =
        new CreateTransactionImportController(createTransactionImportService);

    return CreateTransactionImportController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body } = req;

    const request = await validate(CreateTransactionImportSchema, body);

    const result = await this.createTransactionImportService.execute({
      ...request,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
