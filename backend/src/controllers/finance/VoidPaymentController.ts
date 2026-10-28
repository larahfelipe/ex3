import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { VoidPaymentService } from '@/services/finance';
import { validate } from '@/validation';
import { PaymentParamsSchema } from '@/validation/schema';

export class VoidPaymentController implements Controller {
  private static INSTANCE: VoidPaymentController;
  private readonly voidPaymentService: VoidPaymentService;

  private constructor(voidPaymentService: VoidPaymentService) {
    this.voidPaymentService = voidPaymentService;
  }

  static getInstance(voidPaymentService: VoidPaymentService) {
    if (!VoidPaymentController.INSTANCE)
      VoidPaymentController.INSTANCE = new VoidPaymentController(
        voidPaymentService
      );

    return VoidPaymentController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, params } = req;

    const { id, paymentId } = await validate(PaymentParamsSchema, params);

    const result = await this.voidPaymentService.execute({
      expenseId: id,
      paymentId,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
