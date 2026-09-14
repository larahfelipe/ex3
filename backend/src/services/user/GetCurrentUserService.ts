import type { User } from '@/domain/models';
import { UnauthorizedError } from '@/errors';
import type { UserRepository } from '@/infra/database';

export class GetCurrentUserService {
  private static INSTANCE: GetCurrentUserService;
  private readonly userRepository: UserRepository;

  private constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  static getInstance(userRepository: UserRepository) {
    if (!GetCurrentUserService.INSTANCE)
      GetCurrentUserService.INSTANCE = new GetCurrentUserService(
        userRepository
      );

    return GetCurrentUserService.INSTANCE;
  }

  async execute({
    user
  }: GetCurrentUserService.DTO): Promise<GetCurrentUserService.Result> {
    const profile = await this.userRepository.getProfile(user.id);
    if (!profile) throw new UnauthorizedError();

    return { user: profile };
  }
}

namespace GetCurrentUserService {
  export type DTO = Record<'user', User>;
  export type Result = Record<
    'user',
    Pick<User, 'id' | 'name' | 'email' | 'createdAt' | 'updatedAt'>
  >;
}
