import type { Request, Response } from 'express';

import type { Controller } from '@/interfaces';
import type { SignOutUserService } from '@/services/user';

export class SignOutUserController implements Controller {
  private static INSTANCE: SignOutUserController;
  private readonly signOutUserService: SignOutUserService;

  private constructor(signOutUserService: SignOutUserService) {
    this.signOutUserService = signOutUserService;
  }

  static getInstance(signOutUserService: SignOutUserService) {
    if (!SignOutUserController.INSTANCE)
      SignOutUserController.INSTANCE = new SignOutUserController(
        signOutUserService
      );

    return SignOutUserController.INSTANCE;
  }

  async handle(req: Request, res: Response) {
    const result = await this.signOutUserService.execute({ user: req.user });

    return res.status(200).json(result);
  }
}
