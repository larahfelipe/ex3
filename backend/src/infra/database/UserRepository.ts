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
    return this.prismaClient.user.findMany();
  }

  async getByEmail(email: string) {
    return this.prismaClient.user.findUnique({
      where: { email }
    });
  }

  async getByAccessToken(accessToken: string) {
    return this.prismaClient.user.findFirst({
      where: { accessToken }
    });
  }

  async add(params: UserRepository.AddParams) {
    const { password } = params;

    const hashedPassword = await this.bcrypt.hash(password);

    let newUser = await this.prismaClient.user.create({
      data: { ...params, password: hashedPassword }
    });

    newUser = (({ password, isAdmin, ...rest }) => rest)(newUser) as User;

    return newUser;
  }

  async update(params: UserRepository.UpdateParams) {
    const { id, name, password } = params;

    let updatedUser = await this.prismaClient.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(password && { password: await this.bcrypt.hash(password) })
      }
    });

    updatedUser = (({ password, isAdmin, ...rest }) => rest)(
      updatedUser
    ) as User;

    return updatedUser;
  }

  async updateAccessToken(params: UserRepository.UpdateAccessTokenParams) {
    const { id, accessToken } = params;

    return this.prismaClient.user.update({
      where: { id },
      data: { accessToken }
    });
  }

  async delete(id: string) {
    return this.prismaClient.user.delete({
      where: { id }
    });
  }
}

namespace UserRepository {
  export type AddParams = Pick<User, 'name' | 'email' | 'password'>;
  export type UpdateParams = Pick<User, 'id' | 'name'> & {
    password: string | null;
  };
  export type UpdateAccessTokenParams = Pick<User, 'id' | 'accessToken'>;
}
