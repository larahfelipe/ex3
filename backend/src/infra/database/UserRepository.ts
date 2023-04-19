import { envs } from '@/config';
import type { User } from '@/domain/models';

import { Bcrypt } from '../cryptography';
import { PrismaClient } from './PrismaClient';

export class UserRepository {
  private static INSTANCE: UserRepository;
  private prismaClient: PrismaClient;
  private bcrypt: Bcrypt;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
    this.bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
  }

  static getInstance() {
    if (!UserRepository.INSTANCE)
      UserRepository.INSTANCE = new UserRepository();

    return UserRepository.INSTANCE;
  }

  async getAll() {
    const users = await this.prismaClient.user.findMany();

    return users;
  }

  async getByEmail(email: string) {
    const user = await this.prismaClient.user.findUnique({
      where: {
        email
      }
    });

    return user;
  }

  async getByAccessToken(accessToken: string) {
    const user = await this.prismaClient.user.findFirst({
      where: {
        accessToken
      }
    });

    return user;
  }

  async add(params: UserRepository.AddParams) {
    const { password } = params;

    const hashedPassword = await this.bcrypt.hash(password);

    let newUser = await this.prismaClient.user.create({
      data: { ...params, password: hashedPassword }
    });

    newUser = (({ password, ...rest }) => rest)(newUser) as User;

    return newUser;
  }

  async updateAccessToken(params: UserRepository.UpdateAccessTokenParams) {
    const { id, accessToken } = params;

    await this.prismaClient.user.update({
      where: {
        id
      },
      data: {
        accessToken
      }
    });
  }
}

export namespace UserRepository {
  export type AddParams = Pick<User, 'name' | 'email' | 'password'>;
  export type UpdateAccessTokenParams = Pick<User, 'id' | 'accessToken'>;
}
