import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { TransactionType } from '@/domain/models';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { UpdateTransactionService } from '@/services/transaction';
import { validate } from '@/validation';
import { UpdateTransactionSchema } from '@/validation/schema/transaction/UpdateTransactionSchema';

export class UpdateTransactionController implements Controller {
  private static INSTANCE: UpdateTransactionController;
  private readonly updateTransactionService: UpdateTransactionService;

  private constructor(updateTransactionService: UpdateTransactionService) {
    this.updateTransactionService = updateTransactionService;
  }

  static getInstance(updateTransactionService: UpdateTransactionService) {
    if (!UpdateTransactionController.INSTANCE)
      UpdateTransactionController.INSTANCE = new UpdateTransactionController(
        updateTransactionService
      );

    return UpdateTransactionController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    try {
      const { id, type, price, amount } = await validate(
        UpdateTransactionSchema,
        body
      );

      const result = await this.updateTransactionService.execute({
        id,
        price,
        amount,
        type: type as TransactionType,
        userId: user.id
      });

      return res.status(200).json(result);
    } catch (e) {
      const {
        status = 500,
        name = 'InternalServerError',
        message = DefaultErrorMessages.INTERNAL_SERVER_ERROR
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
