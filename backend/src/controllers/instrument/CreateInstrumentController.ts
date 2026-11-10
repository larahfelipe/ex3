import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { CreateInstrumentService } from '@/services/instrument';
import { validate } from '@/validation';
import { CreateInstrumentSchema } from '@/validation/schema';

export class CreateInstrumentController implements Controller {
  private static INSTANCE: CreateInstrumentController;
  private readonly createInstrumentService: CreateInstrumentService;

  private constructor(createInstrumentService: CreateInstrumentService) {
    this.createInstrumentService = createInstrumentService;
  }

  static getInstance(createInstrumentService: CreateInstrumentService) {
    if (!CreateInstrumentController.INSTANCE)
      CreateInstrumentController.INSTANCE = new CreateInstrumentController(
        createInstrumentService
      );

    return CreateInstrumentController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, body } = req;

    const attributes = await validate(CreateInstrumentSchema, body);

    const result = await this.createInstrumentService.execute({
      ...attributes,
      isAdmin: user.isAdmin
    });

    return res.status(201).json(result);
  }
}
