import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { CreatePortfolioService } from '@/services/portfolio';
import { validate } from '@/validation';
import { CreatePortfolioSchema } from '@/validation/schema';

export class CreatePortfolioController implements Controller {
  private static INSTANCE: CreatePortfolioController;
  private readonly createPortfolioService: CreatePortfolioService;

  private constructor(createPortfolioService: CreatePortfolioService) {
    this.createPortfolioService = createPortfolioService;
  }

  static getInstance(createPortfolioService: CreatePortfolioService) {
    if (!CreatePortfolioController.INSTANCE)
      CreatePortfolioController.INSTANCE = new CreatePortfolioController(
        createPortfolioService
      );

    return CreatePortfolioController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const { user, body } = req;

    const attributes = await validate(CreatePortfolioSchema, body);

    const result = await this.createPortfolioService.execute({
      ...attributes,
      userId: user.id
    });

    return res.status(201).json(result);
  }
}
