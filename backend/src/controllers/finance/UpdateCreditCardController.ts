import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { UpdateCreditCardService } from '@/services/finance';
import { fieldsOf, validate } from '@/validation';
import { UpdateCreditCardSchema } from '@/validation/schema';

export class UpdateCreditCardController implements Controller {
  private static INSTANCE: UpdateCreditCardController;
  private readonly updateCreditCardService: UpdateCreditCardService;

  private constructor(updateCreditCardService: UpdateCreditCardService) {
    this.updateCreditCardService = updateCreditCardService;
  }

  static getInstance(updateCreditCardService: UpdateCreditCardService) {
    if (!UpdateCreditCardController.INSTANCE)
      UpdateCreditCardController.INSTANCE = new UpdateCreditCardController(
        updateCreditCardService
      );

    return UpdateCreditCardController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body, params } = req;

    const card = await validate(UpdateCreditCardSchema, {
      ...fieldsOf(body),
      id: params.id
    });

    const result = await this.updateCreditCardService.execute({
      ...card,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
