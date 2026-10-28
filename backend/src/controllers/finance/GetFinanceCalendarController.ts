import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetFinanceCalendarService } from '@/services/finance';
import { validate } from '@/validation';
import { FinanceCalendarQuerySchema } from '@/validation/schema';

export class GetFinanceCalendarController implements Controller {
  private static INSTANCE: GetFinanceCalendarController;
  private readonly getFinanceCalendarService: GetFinanceCalendarService;

  private constructor(getFinanceCalendarService: GetFinanceCalendarService) {
    this.getFinanceCalendarService = getFinanceCalendarService;
  }

  static getInstance(getFinanceCalendarService: GetFinanceCalendarService) {
    if (!GetFinanceCalendarController.INSTANCE)
      GetFinanceCalendarController.INSTANCE = new GetFinanceCalendarController(
        getFinanceCalendarService
      );

    return GetFinanceCalendarController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(FinanceCalendarQuerySchema, query);

    const result = await this.getFinanceCalendarService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
