import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { UndoTransactionImportService } from '@/services/transaction-import';
import { validate } from '@/validation';
import { UndoTransactionImportSchema } from '@/validation/schema';

export class UndoTransactionImportController implements Controller {
  private static INSTANCE: UndoTransactionImportController;
  private readonly undoTransactionImportService: UndoTransactionImportService;

  private constructor(
    undoTransactionImportService: UndoTransactionImportService
  ) {
    this.undoTransactionImportService = undoTransactionImportService;
  }

  static getInstance(
    undoTransactionImportService: UndoTransactionImportService
  ) {
    if (!UndoTransactionImportController.INSTANCE)
      UndoTransactionImportController.INSTANCE =
        new UndoTransactionImportController(undoTransactionImportService);

    return UndoTransactionImportController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(UndoTransactionImportSchema, params);

    const result = await this.undoTransactionImportService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
