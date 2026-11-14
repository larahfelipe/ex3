import { UserMessages } from '@/config';
import type { Portfolio, User } from '@/domain/models';
import { personNames } from '@/domain/PersonName';
import { ConflictError } from '@/errors';
import type { Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

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
    firstName,
    lastName,
    email,
    password,
    baseCurrency,
    portfolioName
  }: CreateUserService.DTO): Promise<CreateUserService.Result> {
    const account = await this.userRepository.add({
      email,
      password,
      ...personNames(firstName ?? null, lastName ?? null),
      portfolio: { name: portfolioName ?? FIRST_PORTFOLIO_NAME, baseCurrency }
    });

    if (!account) throw new ConflictError(UserMessages.ALREADY_EXISTS);

    const { sessionVersion, ...newUser } = account;

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
  export type DTO = Pick<User, 'email' | 'password'> &
    Pick<Portfolio, 'baseCurrency'> &
    Partial<Pick<User, 'firstName' | 'lastName'>> &
    Partial<Record<'portfolioName', Portfolio['name']>>;
  export type Result = {
    user: Omit<User, 'password' | 'isAdmin' | 'sessionVersion' | 'portfolios'> &
      Record<'accessToken', string>;
    message: string;
  };
}
