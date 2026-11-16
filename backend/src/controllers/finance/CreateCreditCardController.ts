import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { CreateCreditCardService } from '@/services/finance';
import { validate } from '@/validation';
import { CreateCreditCardSchema } from '@/validation/schema';

export class CreateCreditCardController implements Controller {
  private static INSTANCE: CreateCreditCardController;
  private readonly createCreditCardService: CreateCreditCardService;

  private constructor(createCreditCardService: CreateCreditCardService) {
    this.createCreditCardService = createCreditCardService;
  }

  static getInstance(createCreditCardService: CreateCreditCardService) {
    if (!CreateCreditCardController.INSTANCE)
      CreateCreditCardController.INSTANCE = new CreateCreditCardController(
        createCreditCardService
      );

    return CreateCreditCardController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body } = req;

    const card = await validate(CreateCreditCardSchema, body);

    const result = await this.createCreditCardService.execute({
      ...card,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
