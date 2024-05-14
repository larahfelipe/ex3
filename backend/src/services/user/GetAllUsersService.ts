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

  async execute({
    isAdmin
  }: GetAllUsersService.DTO): Promise<GetAllUsersService.Result> {
    if (!isAdmin) throw new ForbiddenError();

    const allUsers = await this.userRepository.getAll();

    return {
      users: allUsers as Array<User>
    };
  }
}

namespace GetAllUsersService {
  export type DTO = Pick<User, 'isAdmin'>;
  export type Result = Record<'users', Array<User>>;
}
