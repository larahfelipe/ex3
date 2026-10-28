import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { isDerivedFromEmail } from '@/domain/PasswordPolicy';
import { ValidationError } from '@/errors';
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
    passwordChange
  }: UpdateUserService.DTO): Promise<UpdateUserService.Result> {
    if (passwordChange) {
      if (isDerivedFromEmail(passwordChange.newPassword, user.email))
        throw new ValidationError(UserMessages.PASSWORD_DERIVED_FROM_EMAIL, [
          {
            path: 'newPassword',
            message: UserMessages.PASSWORD_DERIVED_FROM_EMAIL
          }
        ]);

      const isPasswordValid = await this.bcrypt.compare(
        passwordChange.oldPassword,
        user.password
      );

      if (!isPasswordValid)
        throw new ValidationError(UserMessages.INVALID_PASSWORD);
    }

    const updatedUser = await this.userRepository.update({
      id: user.id,
      name: name ?? null,
      password: passwordChange?.newPassword ?? null
    });

    return {
      user: updatedUser,
      message: UserMessages.UPDATED
    };
  }
}

namespace UpdateUserService {
  export type DTO = {
    user: User;
    name?: string;
    passwordChange?: Record<'oldPassword' | 'newPassword', string>;
  };
  export type Result = {
    user: Omit<User, 'password' | 'isAdmin' | 'sessionVersion' | 'portfolios'>;
    message: string;
  };
}
