import type { Request, Response } from 'express';

import { Errors } from '@/config';
import type { TransactionType } from '@/domain/models';
import type { ApplicationError } from '@/errors';
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

    try {
      const { type, price, amount, assetSymbol } = await validate(
        CreateTransactionSchema,
        body
      );

      const result = await this.createTransactionService.execute({
        price,
        amount,
        assetSymbol,
        type: type as TransactionType,
        userId: user.id
      });

      return res.status(201).json(result);
    } catch (e) {
      const {
        status = Errors.INTERNAL_SERVER_ERROR.status,
        name = Errors.INTERNAL_SERVER_ERROR.name,
        message = Errors.INTERNAL_SERVER_ERROR.message
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
