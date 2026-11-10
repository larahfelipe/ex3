import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { UpdatePaymentService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
import { UpdatePaymentSchema } from '@/validation/schema';

export class UpdatePaymentController implements Controller {
  private static INSTANCE: UpdatePaymentController;
  private readonly updatePaymentService: UpdatePaymentService;

  private constructor(updatePaymentService: UpdatePaymentService) {
    this.updatePaymentService = updatePaymentService;
  }

  static getInstance(updatePaymentService: UpdatePaymentService) {
    if (!UpdatePaymentController.INSTANCE)
      UpdatePaymentController.INSTANCE = new UpdatePaymentController(
        updatePaymentService
      );

    return UpdatePaymentController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const { id, ...payment } = await validate(UpdatePaymentSchema, {
      ...fieldsOf(body),
      id: params.id,
      paymentId: params.paymentId
    });

    const result = await this.updatePaymentService.execute({
      ...payment,
      expenseId: id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
