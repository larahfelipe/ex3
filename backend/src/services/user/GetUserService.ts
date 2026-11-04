import { UserMessages } from '@/config';
import type { User } from '@/domain/models';
import { AuthenticationError } from '@/errors';
import type { Bcrypt, Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

/**
 * Verified against when the email is unknown, so a missing account costs the
 * same bcrypt work as a wrong password and response time does not reveal which
 * emails are registered. Its value is irrelevant: the outcome is discarded. The
 * digest is hashed at the configured cost as the service is built, so not even
 * the first unknown email pays for hashing it.
 */
const UNKNOWN_ACCOUNT_PASSWORD = 'unknown-account-password';

export class GetUserService {
  private static INSTANCE: GetUserService;
  private readonly userRepository: UserRepository;
  private readonly bcrypt: Bcrypt;
  private readonly jwt: Jwt;
  private readonly unknownAccountDigest: Promise<string>;

  private constructor(
    userRepository: UserRepository,
    bcrypt: Bcrypt,
    jwt: Jwt
  ) {
    this.userRepository = userRepository;
    this.bcrypt = bcrypt;
    this.jwt = jwt;
    this.unknownAccountDigest = bcrypt.hash(UNKNOWN_ACCOUNT_PASSWORD);
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
      account?.password ?? (await this.unknownAccountDigest)
    );

    if (!account || !isPasswordValid)
      throw new AuthenticationError(UserMessages.INVALID_CREDENTIALS);

    if (this.bcrypt.needsRehash(account.password))
      await this.userRepository.rehashPassword(
        account.id,
        account.password,
        password
      );

    const user = (({ password, isAdmin, sessionVersion, ...rest }) => rest)(
      account
    );

    const accessToken = await this.jwt.encrypt({
      sub: user.id,
      sessionVersion: await this.userRepository.rotateSessionVersion(user.id)
    });

    return { ...user, accessToken };
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
