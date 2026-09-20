import { UserMessages } from '@/config';
import type { Portfolio, User } from '@/domain/models';
import { ConflictError } from '@/errors';
import type { Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

/**
 * The portfolio every account starts with, and the name the migration gave to
 * the ones created before an account could hold more than one.
 */
const FIRST_PORTFOLIO_NAME = 'Main';

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
    password,
    baseCurrency
  }: CreateUserService.DTO): Promise<CreateUserService.Result> {
    const account = await this.userRepository.add({
      email,
      password,
      name: name ?? '',
      portfolio: { name: FIRST_PORTFOLIO_NAME, baseCurrency }
    });

    if (!account) throw new ConflictError(UserMessages.ALREADY_EXISTS);

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
  export type DTO = Pick<User, 'name' | 'email' | 'password'> &
    Pick<Portfolio, 'baseCurrency'>;
  export type Result = {
    user: Omit<User, 'password' | 'isAdmin' | 'sessionVersion' | 'portfolios'> &
      Record<'accessToken', string>;
    message: string;
  };
}
