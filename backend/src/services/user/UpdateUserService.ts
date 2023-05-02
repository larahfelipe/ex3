import { UserMessages } from '@/constants';
import type { User } from '@/domain/models';
import { BadRequestError } from '@/errors';
import type { Bcrypt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

export class UpdateUserService {
  private static INSTANCE: UpdateUserService;
  private readonly userRepository: UserRepository;
  private readonly bcrypt: Bcrypt;

  private constructor(userRepository: UserRepository, bcrypt: Bcrypt) {
    this.userRepository = userRepository;
    this.bcrypt = bcrypt;
  }

  static getInstance(userRepository: UserRepository, bcrypt: Bcrypt) {
    if (!UpdateUserService.INSTANCE)
      UpdateUserService.INSTANCE = new UpdateUserService(
        userRepository,
        bcrypt
      );

    return UpdateUserService.INSTANCE;
  }

  async execute({
    user,
    name,
    oldPassword,
    newPassword
  }: UpdateUserService.DTO) {
    let isPasswordValid = false;

    if (oldPassword?.length) {
      isPasswordValid = await this.bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid)
        throw new BadRequestError(UserMessages.INVALID_PASSWORD);
    }

    const updatedUser = await this.userRepository.update({
      id: user.id,
      name: name ?? null,
      password: isPasswordValid ? (newPassword as string) : null
    });

    const res: UpdateUserService.Result = {
      user: updatedUser,
      message: UserMessages.UPDATED
    };

    return res;
  }
}

namespace UpdateUserService {
  export type DTO = {
    user: User;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
  };
  export type Result = {
    user: Omit<User, 'password' | 'portfolio'>;
    message: string;
  };
}
