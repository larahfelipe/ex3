import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { BadRequestError } from '@/errors';
import type { Bcrypt } from '@/infra/cryptography';
import type { PortfolioRepository, UserRepository } from '@/infra/database';

export class DeleteUserService {
  private static INSTANCE: DeleteUserService;
  private readonly userRepository: UserRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly bcrypt: Bcrypt;

  private constructor(
    userRepository: UserRepository,
    portfolioRepository: PortfolioRepository,
    bcrypt: Bcrypt
  ) {
    this.userRepository = userRepository;
    this.portfolioRepository = portfolioRepository;
    this.bcrypt = bcrypt;
  }

  static getInstance(
    userRepository: UserRepository,
    portfolioRepository: PortfolioRepository,
    bcrypt: Bcrypt
  ) {
    if (!DeleteUserService.INSTANCE)
      DeleteUserService.INSTANCE = new DeleteUserService(
        userRepository,
        portfolioRepository,
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
      throw new BadRequestError(UserMessages.INVALID_PASSWORD);

    await this.portfolioRepository.delete(user.id);

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
