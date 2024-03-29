import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { BadRequestError } from '@/errors';
import type { Jwt } from '@/infra/cryptography';
import type { PortfolioRepository, UserRepository } from '@/infra/database';

export class CreateUserService {
  private static INSTANCE: CreateUserService;
  private readonly userRepository: UserRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly jwt: Jwt;

  private constructor(
    userRepository: UserRepository,
    portfolioRepository: PortfolioRepository,
    jwt: Jwt
  ) {
    this.userRepository = userRepository;
    this.portfolioRepository = portfolioRepository;
    this.jwt = jwt;
  }

  static getInstance(
    userRepository: UserRepository,
    portfolioRepository: PortfolioRepository,
    jwt: Jwt
  ) {
    if (!CreateUserService.INSTANCE)
      CreateUserService.INSTANCE = new CreateUserService(
        userRepository,
        portfolioRepository,
        jwt
      );

    return CreateUserService.INSTANCE;
  }

  async execute({ name, email, password }: CreateUserService.DTO) {
    const userAlreadyExists = await this.userRepository.getByEmail(email);

    if (userAlreadyExists)
      throw new BadRequestError(UserMessages.ALREADY_EXISTS);

    const newUser = await this.userRepository.add({
      email,
      password,
      name: name ?? ''
    });

    await this.portfolioRepository.add(newUser.id);

    const encryptedAccessToken = await this.jwt.encrypt(newUser.id);

    await this.userRepository.updateAccessToken({
      id: newUser.id,
      accessToken: encryptedAccessToken
    });

    const res: CreateUserService.Result = {
      user: {
        ...newUser,
        accessToken: encryptedAccessToken
      },
      message: UserMessages.CREATED
    };

    return res;
  }
}

namespace CreateUserService {
  export type DTO = Pick<User, 'name' | 'email' | 'password'>;
  export type Result = {
    user: Omit<User, 'password' | 'isAdmin' | 'portfolio'>;
    message: string;
  };
}
