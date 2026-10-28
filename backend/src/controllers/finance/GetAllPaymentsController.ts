import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetAllPaymentsService } from '@/services/finance';
import { validate } from '@/validation';
import { GetPaymentsQuerySchema } from '@/validation/schema';

export class GetAllPaymentsController implements Controller {
  private static INSTANCE: GetAllPaymentsController;
  private readonly getAllPaymentsService: GetAllPaymentsService;

  private constructor(getAllPaymentsService: GetAllPaymentsService) {
    this.getAllPaymentsService = getAllPaymentsService;
  }

  static getInstance(getAllPaymentsService: GetAllPaymentsService) {
    if (!GetAllPaymentsController.INSTANCE)
      GetAllPaymentsController.INSTANCE = new GetAllPaymentsController(
        getAllPaymentsService
      );

    return GetAllPaymentsController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, query } = req;

    const filters = await validate(GetPaymentsQuerySchema, query);

    const result = await this.getAllPaymentsService.execute({
      ...filters,
      userId: user.id
    });

    return res.status(200).json(result);
  }
}
