import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { SearchInstrumentsService } from '@/services/instrument';
import { validate } from '@/validation';
import { SearchInstrumentsSchema } from '@/validation/schema';

export class SearchInstrumentsController implements Controller {
  private static INSTANCE: SearchInstrumentsController;
  private readonly searchInstrumentsService: SearchInstrumentsService;

  private constructor(searchInstrumentsService: SearchInstrumentsService) {
    this.searchInstrumentsService = searchInstrumentsService;
  }

  static getInstance(searchInstrumentsService: SearchInstrumentsService) {
    if (!SearchInstrumentsController.INSTANCE)
      SearchInstrumentsController.INSTANCE = new SearchInstrumentsController(
        searchInstrumentsService
      );

    return SearchInstrumentsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { query } = await validate(SearchInstrumentsSchema, req.query);

    const result = await this.searchInstrumentsService.execute({
      userId: req.user.id,
      query
    });

    return res.status(200).json(result);
  }
}
