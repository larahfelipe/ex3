import type { Request, Response } from 'express';

import { Errors } from '@/config';
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
    const { user, body, params } = req;

    try {
      const { id, type, price, amount } = await validate(
        UpdateTransactionSchema,
        { ...body, id: params.id }
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
        status = Errors.INTERNAL_SERVER_ERROR.status,
        name = Errors.INTERNAL_SERVER_ERROR.name,
        message = Errors.INTERNAL_SERVER_ERROR.message
      } = e as ApplicationError;

      return res.status(status).json({ name, message });
    }
  }
}
