import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { GetCurrentUserService } from '@/services/user';

export class GetCurrentUserController implements Controller {
  private static INSTANCE: GetCurrentUserController;
  private readonly getCurrentUserService: GetCurrentUserService;

  private constructor(getCurrentUserService: GetCurrentUserService) {
    this.getCurrentUserService = getCurrentUserService;
  }

  static getInstance(getCurrentUserService: GetCurrentUserService) {
    if (!GetCurrentUserController.INSTANCE)
      GetCurrentUserController.INSTANCE = new GetCurrentUserController(
        getCurrentUserService
      );

    return GetCurrentUserController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const result = await this.getCurrentUserService.execute({
      user: req.user
    });

    return res.status(200).json(result);
  }
}
