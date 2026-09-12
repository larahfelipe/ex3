import type { Request, Response } from 'express';

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
    const { user, params } = req;

    const { id } = await validate(DeleteTransactionSchema, params);

    const result = await this.deleteTransactionService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
