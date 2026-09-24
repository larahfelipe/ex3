import { envs } from '@/config';
import type { Portfolio, User } from '@/domain/models';
import { portfolioNameKey } from '@/domain/PortfolioName';

import { Bcrypt } from '../cryptography';
import { PrismaClient } from './PrismaClient';

/**
 * Never returned by reads meant for a response: the password digest, and the
 * session version that decides which access token is still honoured.
 */
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

  /**
   * User and first portfolio are one nested write, which Prisma runs in a
   * single transaction: a failure leaves neither behind. The unique index on
   * email is the only authority on whether the address is free, so of
   * concurrent sign-ups for one email exactly one succeeds and the others
   * resolve to null; the other unique columns written (`users.id`,
   * `portfolios.id`, and `portfolios.userId` with `nameKey`) hold ids generated
   * by the same statement, so a violation can only mean the email. The session version is returned so the caller can
   * issue the first token.
   */
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

  /**
   * A new password revokes the current session in the same statement, so no
   * token issued before the change survives it.
   */
  async update(params: UserRepository.UpdateParams) {
    const { id, name, password } = params;

    return this.prismaClient.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(password && {
          password: await this.bcrypt.hash(password),
          sessionVersion: { increment: 1 }
        })
      },
      omit: PROFILE_OMITTED_COLUMNS
    });
  }

  /**
   * The increment is a single UPDATE, so concurrent callers serialize on the row
   * lock and each receives a distinct version: at most one token per value.
   */
  async rotateSessionVersion(id: string) {
    const { sessionVersion } = await this.prismaClient.user.update({
      where: { id },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true }
    });

    return sessionVersion;
  }

  /**
   * The account and everything it holds go in one serializable transaction,
   * dependents first, so neither a failure nor a concurrent write leaves an
   * orphan behind. Every step matches rows by owner instead of requiring them to
   * exist, so a concurrent deletion of the same account ends in the same state.
   */
  async delete(id: string) {
    const ownedByUser = { portfolio: { userId: id } };

    await this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.transaction.deleteMany({ where: ownedByUser });
      await transactionClient.position.deleteMany({ where: ownedByUser });
      await transactionClient.marketQuote.deleteMany({
        where: { instrument: { ownerId: id } }
      });
      await transactionClient.instrument.deleteMany({ where: { ownerId: id } });
      await transactionClient.portfolio.deleteMany({ where: { userId: id } });
      await transactionClient.user.deleteMany({ where: { id } });
    });
  }
}

namespace UserRepository {
  export type AddParams = Pick<User, 'name' | 'email' | 'password'> &
    Record<'portfolio', Pick<Portfolio, 'name' | 'baseCurrency'>>;
  export type UpdateParams = Pick<User, 'id' | 'name'> & {
    password: string | null;
  };
}
