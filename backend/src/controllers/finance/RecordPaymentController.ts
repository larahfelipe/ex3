import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { RecordPaymentService } from '@/services/finance';
import { validate } from '@/validation';
import { RecordPaymentSchema } from '@/validation/schema';

export class RecordPaymentController implements Controller {
  private static INSTANCE: RecordPaymentController;
  private readonly recordPaymentService: RecordPaymentService;

  private constructor(recordPaymentService: RecordPaymentService) {
    this.recordPaymentService = recordPaymentService;
  }

  static getInstance(recordPaymentService: RecordPaymentService) {
    if (!RecordPaymentController.INSTANCE)
      RecordPaymentController.INSTANCE = new RecordPaymentController(
        recordPaymentService
      );

    return RecordPaymentController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const { id, ...entry } = await validate(RecordPaymentSchema, {
      ...body,
      id: params.id
    });

    const result = await this.recordPaymentService.execute({
      ...entry,
      expenseId: id,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
