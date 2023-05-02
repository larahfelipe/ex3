import { UserMessages } from '@/constants';
import type { User } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { Bcrypt, Jwt } from '@/infra/cryptography';
import type { UserRepository } from '@/infra/database';

export class GetUserService {
  private static INSTANCE: GetUserService;
  private readonly userRepository: UserRepository;
  private readonly bcrypt: Bcrypt;
  private readonly jwt: Jwt;

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

  async execute({ email, password }: GetUserService.DTO) {
    const userExists = await this.userRepository.getByEmail(email);

    if (userExists) {
      const isPasswordValid = await this.bcrypt.compare(
        password,
        userExists.password
      );

      if (isPasswordValid) {
        const user = (({ password, ...rest }) => rest)(userExists);

        const encryptedAccessToken = await this.jwt.encrypt(user.id);

        await this.userRepository.updateAccessToken({
          id: user.id,
          accessToken: encryptedAccessToken
        });

        const res: GetUserService.Result = {
          ...user,
          accessToken: encryptedAccessToken
        };

        return res;
      }
    }

    throw new NotFoundError(UserMessages.NOT_FOUND);
  }
}

namespace GetUserService {
  export type DTO = Pick<User, 'email' | 'password'>;
  export type Result = Omit<User, 'password' | 'portfolio'>;
}
