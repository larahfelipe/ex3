import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllInstrumentsService } from '@/services/instrument';
import { validate } from '@/validation';
import { PaginationQuerySchema } from '@/validation/schema';

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
    const { page, limit } = await validate(PaginationQuerySchema, req.query);

    const result = await this.getAllInstrumentsService.execute({ page, limit });

    return res.status(200).json(result);
  }
}
