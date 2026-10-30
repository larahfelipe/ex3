import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { RecordPaymentService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
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

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const { id, ...entry } = await validate(RecordPaymentSchema, {
      ...fieldsOf(body),
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
