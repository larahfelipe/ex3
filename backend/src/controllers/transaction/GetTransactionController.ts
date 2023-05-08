import type { Request, Response } from 'express';

import { DefaultErrorMessages } from '@/config';
import type { ApplicationError } from '@/errors';
import type { Controller } from '@/interfaces';
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

  async handle(req: Request, res: Response) {
    try {
      const { id } = await validate(GetTransactionSchema, req.body);

      const result = await this.getTransactionService.execute({
        id
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
