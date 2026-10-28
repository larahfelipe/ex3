import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { AuthenticationError } from '@/errors';
import type { Bcrypt, Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

/**
 * Verified against when the email is unknown, so a missing account costs the
 * same bcrypt work as a wrong password and response time does not reveal which
 * emails are registered. Its value is irrelevant: the outcome is discarded.
 */
const UNKNOWN_ACCOUNT_PASSWORD = 'unknown-account-password';

export class GetUserService {
  private static INSTANCE: GetUserService;
  private readonly userRepository: UserRepository;
  private readonly bcrypt: Bcrypt;
  private readonly jwt: Jwt;
  private unknownAccountDigest?: Promise<string>;

  private constructor(
    userRepository: UserRepository,
    bcrypt: Bcrypt,
    jwt: Jwt
  ) {
    this.userRepository = userRepository;
    this.bcrypt = bcrypt;
    this.jwt = jwt;
  }

  static getInstance(userRepository: UserRepository, bcrypt: Bcrypt, jwt: Jwt) {
    if (!GetUserService.INSTANCE)
      GetUserService.INSTANCE = new GetUserService(userRepository, bcrypt, jwt);

    return GetUserService.INSTANCE;
  }

  async execute({
    email,
    password
  }: GetUserService.DTO): Promise<GetUserService.Result> {
    const account = await this.userRepository.getByEmail(email);

    const isPasswordValid = await this.bcrypt.compare(
      password,
      account?.password ?? (await this.getUnknownAccountDigest())
    );

    if (!account || !isPasswordValid)
      throw new AuthenticationError(UserMessages.INVALID_CREDENTIALS);

    const user = (({ password, isAdmin, sessionVersion, ...rest }) => rest)(
      account
    );

    const accessToken = await this.jwt.encrypt({
      sub: user.id,
      sessionVersion: await this.userRepository.rotateSessionVersion(user.id)
    });

    return { ...user, accessToken };
  }

  /** Hashed with the configured cost, so both branches do equal work. */
  private getUnknownAccountDigest() {
    this.unknownAccountDigest ??= this.bcrypt.hash(UNKNOWN_ACCOUNT_PASSWORD);

    return this.unknownAccountDigest;
  }
}

namespace GetUserService {
  export type DTO = Pick<User, 'email' | 'password'>;
  export type Result = Omit<
    User,
    'password' | 'isAdmin' | 'sessionVersion' | 'portfolios'
  > &
    Record<'accessToken', string>;
}
