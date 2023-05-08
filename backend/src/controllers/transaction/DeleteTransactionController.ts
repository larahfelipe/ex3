import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
import type { DeleteTransactionService } from '@/services/transaction';
import { validate } from '@/validation';
import { DeleteTransactionSchema } from '@/validation/schema';

export class DeleteTransactionController implements Controller {
  private static INSTANCE: DeleteTransactionController;
  private readonly deleteTransactionService: DeleteTransactionService;

  private constructor(deleteTransactionService: DeleteTransactionService) {
    this.deleteTransactionService = deleteTransactionService;
  }

  static getInstance(deleteTransactionService: DeleteTransactionService) {
    if (!DeleteTransactionController.INSTANCE)
      DeleteTransactionController.INSTANCE = new DeleteTransactionController(
        deleteTransactionService
      );

    return DeleteTransactionController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    try {
      const { id } = await validate(DeleteTransactionSchema, body);

      const result = await this.deleteTransactionService.execute({
        id,
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
