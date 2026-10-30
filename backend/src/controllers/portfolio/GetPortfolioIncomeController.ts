import type { Response } from 'express';

import type { Controller, ControllerRequest } from '@/interfaces';
import type { GetPortfolioIncomeService } from '@/services/portfolio';
import { validate } from '@/validation';
import { PortfolioScopeSchema } from '@/validation/schema';

export class GetPortfolioIncomeController implements Controller {
  private static INSTANCE: GetPortfolioIncomeController;
  private readonly getPortfolioIncomeService: GetPortfolioIncomeService;

  private constructor(getPortfolioIncomeService: GetPortfolioIncomeService) {
    this.getPortfolioIncomeService = getPortfolioIncomeService;
  }

  static getInstance(getPortfolioIncomeService: GetPortfolioIncomeService) {
    if (!GetPortfolioIncomeController.INSTANCE)
      GetPortfolioIncomeController.INSTANCE = new GetPortfolioIncomeController(
        getPortfolioIncomeService
      );

    return GetPortfolioIncomeController.INSTANCE;
  }

  async handle(req: ControllerRequest, res: Response) {
    const { user, query } = req;

    const { portfolioId } = await validate(PortfolioScopeSchema, query);

    const result = await this.getPortfolioIncomeService.execute({
      userId: user.id,
      portfolioId
    });

    return res.status(200).json(result);
  }
}
