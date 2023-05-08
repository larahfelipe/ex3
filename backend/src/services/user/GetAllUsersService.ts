import { DefaultErrorMessages } from '@/config';
import type { User } from '@/domain/models';
import { ForbiddenError } from '@/errors';
import type { UserRepository } from '@/infra/database';

export class GetAllUsersService {
  private static INSTANCE: GetAllUsersService;
  private readonly userRepository: UserRepository;

  private constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  static getInstance(userRepository: UserRepository) {
    if (!GetAllUsersService.INSTANCE)
      GetAllUsersService.INSTANCE = new GetAllUsersService(userRepository);

    return GetAllUsersService.INSTANCE;
  }

  async execute({ isStaff }: GetAllUsersService.DTO) {
    if (!isStaff) throw new ForbiddenError(DefaultErrorMessages.FORBIDDEN);

    const allUsers = await this.userRepository.getAll();

    const res: GetAllUsersService.Result = {
      users: allUsers as Array<User>
    };

    return res;
  }
}

namespace GetAllUsersService {
  export type DTO = Pick<User, 'isStaff'>;
  export type Result = Record<'users', Array<User>>;
}
