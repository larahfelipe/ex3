import { envs } from '@/config';
import type { User } from '@/domain/models';
import { Bcrypt, Jwt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';

export class UserLoader {
  private static INSTANCE: UserLoader;
  private userRepository: UserRepository;
  private bcrypt: Bcrypt;
  private jwt: Jwt;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
    this.bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
    this.jwt = Jwt.getInstance(envs.jwtSecret);
  }

  static getInstance() {
    if (!UserLoader.INSTANCE) UserLoader.INSTANCE = new UserLoader();

    return UserLoader.INSTANCE;
  }

  async loadAll() {
    const users = await this.userRepository.getAll();

    return users;
  }

  async loadByCredentials(params: UserLoader.LoadByCredentialsParams) {
    const { email, password } = params;

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

        return {
          ...user,
          accessToken: encryptedAccessToken
        } as User;
      }
    }

    return null;
  }
}

export namespace UserLoader {
  export type LoadByCredentialsParams = Pick<User, 'email' | 'password'>;
}
