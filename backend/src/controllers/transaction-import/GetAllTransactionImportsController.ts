import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetAllTransactionImportsService } from '@/services/transaction-import';
import { validate } from '@/validation';
import { GetTransactionImportsQuerySchema } from '@/validation/schema';

export class GetAllTransactionImportsController implements Controller {
  private static INSTANCE: GetAllTransactionImportsController;
  private readonly getAllTransactionImportsService: GetAllTransactionImportsService;

  private constructor(
    getAllTransactionImportsService: GetAllTransactionImportsService
  ) {
    this.getAllTransactionImportsService = getAllTransactionImportsService;
  }

  static getInstance(
    getAllTransactionImportsService: GetAllTransactionImportsService
  ) {
    if (!GetAllTransactionImportsController.INSTANCE)
      GetAllTransactionImportsController.INSTANCE =
        new GetAllTransactionImportsController(getAllTransactionImportsService);

    return GetAllTransactionImportsController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, query } = req;

    const filters = await validate(GetTransactionImportsQuerySchema, query);

    const result = await this.getAllTransactionImportsService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
