import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllInstrumentsService } from '@/services/instrument';
import { validate } from '@/validation';
import { GetAllInstrumentsSchema } from '@/validation/schema';

export class GetAllInstrumentsController implements Controller {
  private static INSTANCE: GetAllInstrumentsController;
  private readonly getAllInstrumentsService: GetAllInstrumentsService;

  private constructor(getAllInstrumentsService: GetAllInstrumentsService) {
    this.getAllInstrumentsService = getAllInstrumentsService;
  }

  static getInstance(getAllInstrumentsService: GetAllInstrumentsService) {
    if (!GetAllInstrumentsController.INSTANCE)
      GetAllInstrumentsController.INSTANCE = new GetAllInstrumentsController(
        getAllInstrumentsService
      );

    return GetAllInstrumentsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { page, limit, search } = await validate(
      GetAllInstrumentsSchema,
      req.query
    );

    const result = await this.getAllInstrumentsService.execute({
      userId: req.user.id,
      page,
      limit,
      search
    });

    return res.status(200).json(result);
  }
}
