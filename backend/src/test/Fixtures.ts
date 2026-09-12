import { TransactionTypes, envs } from '@/config';
import type { Asset, Transaction, User } from '@/domain/models';
import { Bcrypt } from '@/infra/cryptography';
import { PrismaClient } from '@/infra/database/PrismaClient';

/**
 * Plain-text counterpart of every fixture user's stored digest. Tests that sign
 * in need the password that matches the hash, so it cannot be generated.
 */
export const FIXTURE_PASSWORD = 'fixture-password';

export const FIXTURE_USER_EMAIL = 'holder@ex3.app';
export const FIXTURE_ASSET_SYMBOL = 'BTC';

const FIXTURE_TRANSACTION_AMOUNT = 2;
const FIXTURE_TRANSACTION_PRICE = 50_000;

const prismaClient = PrismaClient.getInstance();
const bcrypt = Bcrypt.getInstance(envs.bcryptSalt);

/**
 * Hashing is the slowest part of seeding a user and every fixture user shares
 * the same password, so the digest is computed once per test process.
 */
let fixturePasswordDigest: Promise<string> | null = null;

const passwordDigest = () => {
  fixturePasswordDigest ??= bcrypt.hash(FIXTURE_PASSWORD);

  return fixturePasswordDigest;
};

export const createUser = async (
  overrides: Partial<Pick<User, 'name' | 'email' | 'isAdmin'>> = {}
) =>
  prismaClient.user.create({
    data: {
      name: 'Fixture Holder',
      email: FIXTURE_USER_EMAIL,
      password: await passwordDigest(),
      ...overrides
    }
  });

export const createPortfolio = async (userId: string) =>
  prismaClient.portfolio.create({ data: { userId } });

export const createAsset = async (
  params: Pick<Asset, 'portfolioId'> &
    Partial<Pick<Asset, 'symbol' | 'amount' | 'balance'>>
) =>
  prismaClient.asset.create({
    data: { symbol: FIXTURE_ASSET_SYMBOL, ...params }
  });

export const createTransaction = async (
  params: Pick<Transaction, 'assetSymbol'> &
    Partial<Pick<Transaction, 'type' | 'amount' | 'price'>>
) =>
  prismaClient.transaction.create({
    data: {
      type: TransactionTypes.BUY,
      amount: FIXTURE_TRANSACTION_AMOUNT,
      price: FIXTURE_TRANSACTION_PRICE,
      ...params
    }
  });

/**
 * Smallest coherent graph the API can operate on: a user with a portfolio
 * holding one asset with one transaction. The asset position is stated
 * explicitly instead of derived, because deriving it is what FASE 4 changes.
 */
export const seedPortfolio = async (
  overrides: { email?: string; symbol?: string } = {}
) => {
  const { email, symbol } = overrides;

  const user = await createUser(email ? { email } : {});
  const portfolio = await createPortfolio(user.id);

  const asset = await createAsset({
    portfolioId: portfolio.id,
    amount: FIXTURE_TRANSACTION_AMOUNT,
    balance: FIXTURE_TRANSACTION_AMOUNT * FIXTURE_TRANSACTION_PRICE,
    ...(symbol && { symbol })
  });

  const transaction = await createTransaction({ assetSymbol: asset.symbol });

  return { user, portfolio, asset, transaction };
};
