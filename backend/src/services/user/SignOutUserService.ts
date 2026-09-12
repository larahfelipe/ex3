import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import type { UserRepository } from '@/infra/database';

export class SignOutUserService {
  private static INSTANCE: SignOutUserService;
  private readonly userRepository: UserRepository;

  private constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  static getInstance(userRepository: UserRepository) {
    if (!SignOutUserService.INSTANCE)
      SignOutUserService.INSTANCE = new SignOutUserService(userRepository);

    return SignOutUserService.INSTANCE;
  }

  async execute({
    user
  }: SignOutUserService.DTO): Promise<SignOutUserService.Result> {
    await this.userRepository.rotateSessionVersion(user.id);

    return {
      message: UserMessages.SIGNED_OUT
    };
  }
}

namespace SignOutUserService {
  export type DTO = Record<'user', User>;
  export type Result = Record<'message', string>;
}
