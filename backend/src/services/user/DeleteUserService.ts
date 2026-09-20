import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { ValidationError } from '@/errors';
import type { Bcrypt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

export class DeleteUserService {
  private static INSTANCE: DeleteUserService;
  private readonly userRepository: UserRepository;
  private readonly bcrypt: Bcrypt;

  private constructor(userRepository: UserRepository, bcrypt: Bcrypt) {
    this.userRepository = userRepository;
    this.bcrypt = bcrypt;
  }

  static getInstance(userRepository: UserRepository, bcrypt: Bcrypt) {
    if (!DeleteUserService.INSTANCE)
      DeleteUserService.INSTANCE = new DeleteUserService(
        userRepository,
        bcrypt
      );

    return DeleteUserService.INSTANCE;
  }

  async execute({
    user,
    password
  }: DeleteUserService.DTO): Promise<DeleteUserService.Result> {
    const isPasswordValid = await this.bcrypt.compare(password, user.password);

    if (!isPasswordValid)
      throw new ValidationError(UserMessages.INVALID_PASSWORD);

    await this.userRepository.delete(user.id);

    return {
      message: UserMessages.DELETED
    };
  }
}

namespace DeleteUserService {
  export type DTO = {
    user: User;
    password: string;
  };
  export type Result = Record<'message', string>;
}
