import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { DeleteCreditCardService } from '@/services/finance';
import { validate } from '@/validation';
import { CreditCardParamsSchema } from '@/validation/schema';

export class DeleteCreditCardController implements Controller {
  private static INSTANCE: DeleteCreditCardController;
  private readonly deleteCreditCardService: DeleteCreditCardService;

  private constructor(deleteCreditCardService: DeleteCreditCardService) {
    this.deleteCreditCardService = deleteCreditCardService;
  }

  static getInstance(deleteCreditCardService: DeleteCreditCardService) {
    if (!DeleteCreditCardController.INSTANCE)
      DeleteCreditCardController.INSTANCE = new DeleteCreditCardController(
        deleteCreditCardService
      );

    return DeleteCreditCardController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, params } = req;

    const { id } = await validate(CreditCardParamsSchema, params);

    const result = await this.deleteCreditCardService.execute({
      id,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
