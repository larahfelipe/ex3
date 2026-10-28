import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { UpdateInstrumentService } from '@/services/instrument';
import { validate } from '@/validation';
import { UpdateInstrumentSchema } from '@/validation/schema';

export class UpdateInstrumentController implements Controller {
  private static INSTANCE: UpdateInstrumentController;
  private readonly updateInstrumentService: UpdateInstrumentService;

  private constructor(updateInstrumentService: UpdateInstrumentService) {
    this.updateInstrumentService = updateInstrumentService;
  }

  static getInstance(updateInstrumentService: UpdateInstrumentService) {
    if (!UpdateInstrumentController.INSTANCE)
      UpdateInstrumentController.INSTANCE = new UpdateInstrumentController(
        updateInstrumentService
      );

    return UpdateInstrumentController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body, params } = req;

    const { symbol, attributes } = await validate(UpdateInstrumentSchema, {
      symbol: params.symbol,
      attributes: body
    });

    const result = await this.updateInstrumentService.execute({
      symbol,
      attributes,
      userId: user.id,
      isAdmin: user.isAdmin
    });

    return res.status(200).json(result);
  }
}
