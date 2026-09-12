import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { BadRequestError } from '@/errors';
import type { Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

export class CreateUserService {
  private static INSTANCE: CreateUserService;
  private readonly userRepository: UserRepository;
  private readonly jwt: Jwt;

  private constructor(userRepository: UserRepository, jwt: Jwt) {
    this.userRepository = userRepository;
    this.jwt = jwt;
  }

  static getInstance(userRepository: UserRepository, jwt: Jwt) {
    if (!CreateUserService.INSTANCE)
      CreateUserService.INSTANCE = new CreateUserService(userRepository, jwt);

    return CreateUserService.INSTANCE;
  }

  async execute({
    name,
    email,
    password
  }: CreateUserService.DTO): Promise<CreateUserService.Result> {
    const account = await this.userRepository.add({
      email,
      password,
      name: name ?? ''
    });

    if (!account) throw new BadRequestError(UserMessages.ALREADY_EXISTS);

    const { sessionVersion, ...newUser } = account;

    // The row was created by this call, so no other token carries its version.
    const accessToken = await this.jwt.encrypt({
      sub: newUser.id,
      sessionVersion
    });

    return {
      user: { ...newUser, accessToken },
      message: UserMessages.CREATED
    };
  }
}

namespace CreateUserService {
  export type DTO = Pick<User, 'name' | 'email' | 'password'>;
  export type Result = {
    user: Omit<User, 'password' | 'isAdmin' | 'sessionVersion' | 'portfolio'> &
      Record<'accessToken', string>;
    message: string;
  };
}
