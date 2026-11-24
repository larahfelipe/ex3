import { envs } from '@/config';
import type { Portfolio, User } from '@/domain/models';
import { portfolioNameKey } from '@/domain/PortfolioName';

import { Bcrypt } from '../cryptography';
import { PrismaClient } from './PrismaClient';

const CREDENTIAL_COLUMNS = { password: true, sessionVersion: true } as const;

const PROFILE_OMITTED_COLUMNS = {
  ...CREDENTIAL_COLUMNS,
  isAdmin: true
} as const;

export class UserRepository {
  private static INSTANCE: UserRepository;
  private prismaClient: PrismaClient;
  private bcrypt: Bcrypt;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
    this.bcrypt = Bcrypt.getInstance(envs.bcryptSalt);
  }

  static getInstance() {
    if (!UserRepository.INSTANCE)
      UserRepository.INSTANCE = new UserRepository();

    return UserRepository.INSTANCE;
  }

  async getAll() {
    return this.prismaClient.user.findMany({ omit: CREDENTIAL_COLUMNS });
  }

  async getByEmail(email: string) {
    return this.prismaClient.user.findUnique({
      where: { email }
    });
  }

  async getById(id: string) {
    return this.prismaClient.user.findUnique({
      where: { id }
    });
  }

  async getProfile(id: string) {
    return this.prismaClient.user.findUnique({
      where: { id },
      omit: PROFILE_OMITTED_COLUMNS
    });
  }

  async add(params: UserRepository.AddParams) {
    const { portfolio, ...account } = params;
    const hashedPassword = await this.bcrypt.hash(account.password);

    try {
      return await this.prismaClient.user.create({
        data: {
          ...account,
          password: hashedPassword,
          portfolios: {
            create: { ...portfolio, nameKey: portfolioNameKey(portfolio.name) }
          }
        },
        omit: { password: true, isAdmin: true }
      });
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  async update(params: UserRepository.UpdateParams) {
    const { id, names, locale, password } = params;

    return this.prismaClient.user.update({
      where: { id },
      data: {
        ...names,
        ...(locale && { locale }),
        ...(password && {
          password: await this.bcrypt.hash(password),
          sessionVersion: { increment: 1 }
        })
      },
      omit: PROFILE_OMITTED_COLUMNS
    });
  }

  /**
   * Rehashes at the configured cost only while the stored digest is still the
   * one the sign-in verified, so a password changed meanwhile is kept.
   */
  async rehashPassword(id: string, verifiedDigest: string, password: string) {
    await this.prismaClient.user.updateMany({
      where: { id, password: verifiedDigest },
      data: { password: await this.bcrypt.hash(password) }
    });
  }

  async rotateSessionVersion(id: string) {
    const { sessionVersion } = await this.prismaClient.user.update({
      where: { id },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true }
    });

    return sessionVersion;
  }

  async delete(id: string) {
    const ownedByUser = { portfolio: { userId: id } };

    await this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.transaction.deleteMany({ where: ownedByUser });
      await transactionClient.position.deleteMany({ where: ownedByUser });
      await transactionClient.transactionImport.deleteMany({
        where: ownedByUser
      });
      await transactionClient.marketQuote.deleteMany({
        where: { instrument: { ownerId: id } }
      });
      await transactionClient.instrument.deleteMany({ where: { ownerId: id } });
      await transactionClient.portfolio.deleteMany({ where: { userId: id } });
      await transactionClient.financeEvent.deleteMany({
        where: { userId: id }
      });
      await transactionClient.expensePayment.deleteMany({
        where: { userId: id }
      });
      await transactionClient.expense.deleteMany({ where: { userId: id } });
      await transactionClient.installmentPlan.deleteMany({
        where: { userId: id }
      });
      await transactionClient.recurringExpense.deleteMany({
        where: { userId: id }
      });
      await transactionClient.creditCard.deleteMany({ where: { userId: id } });
      await transactionClient.financeSettings.deleteMany({
        where: { userId: id }
      });
      await transactionClient.financeNotificationMark.deleteMany({
        where: { userId: id }
      });
      await transactionClient.user.deleteMany({ where: { id } });
    });
  }
}

namespace UserRepository {
  export type AddParams = Pick<
    User,
    'name' | 'firstName' | 'lastName' | 'email' | 'password'
  > &
    Record<'portfolio', Pick<Portfolio, 'name' | 'baseCurrency'>>;
  export type UpdateParams = Pick<User, 'id'> & {
    names: Pick<User, 'name' | 'firstName' | 'lastName'> | null;
    locale: User['locale'];
    password: string | null;
  };
}
