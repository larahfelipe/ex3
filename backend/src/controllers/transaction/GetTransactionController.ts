import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetTransactionService } from '@/services/transaction';
import { validate } from '@/validation';
import { GetTransactionSchema } from '@/validation/schema';

export class GetTransactionController implements Controller {
  private static INSTANCE: GetTransactionController;
  private readonly getTransactionService: GetTransactionService;

  private constructor(getTransactionService: GetTransactionService) {
    this.getTransactionService = getTransactionService;
  }

  static getInstance(getTransactionService: GetTransactionService) {
    if (!GetTransactionController.INSTANCE)
      GetTransactionController.INSTANCE = new GetTransactionController(
        getTransactionService
      );

    return GetTransactionController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(GetTransactionSchema, params);

    const result = await this.getTransactionService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
