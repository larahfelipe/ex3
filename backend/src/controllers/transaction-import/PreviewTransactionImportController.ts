import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { PreviewTransactionImportService } from '@/services/transaction-import';
import { validate } from '@/validation';
import { PreviewTransactionImportSchema } from '@/validation/schema';

export class PreviewTransactionImportController implements Controller {
  private static INSTANCE: PreviewTransactionImportController;
  private readonly previewTransactionImportService: PreviewTransactionImportService;

  private constructor(
    previewTransactionImportService: PreviewTransactionImportService
  ) {
    this.previewTransactionImportService = previewTransactionImportService;
  }

  static getInstance(
    previewTransactionImportService: PreviewTransactionImportService
  ) {
    if (!PreviewTransactionImportController.INSTANCE)
      PreviewTransactionImportController.INSTANCE =
        new PreviewTransactionImportController(previewTransactionImportService);

    return PreviewTransactionImportController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body } = req;

    const request = await validate(PreviewTransactionImportSchema, body);

    const result = await this.previewTransactionImportService.execute({
      ...request,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
