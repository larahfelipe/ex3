import { InstrumentTypes, TransactionTypes, envs } from '@/config';
import type {
  Instrument,
  Portfolio,
  Position,
  Transaction,
  User
} from '@/domain/models';
import { Bcrypt } from '@/infra/cryptography';
import { PrismaClient } from '@/infra/database/PrismaClient';

/**
 * Plain-text counterpart of every fixture user's stored digest. Tests that sign
 * in need the password that matches the hash, so it cannot be generated.
 */
export const FIXTURE_PASSWORD = 'fixture-password';

export const FIXTURE_USER_EMAIL = 'holder@ex3.app';
export const FIXTURE_ASSET_SYMBOL = 'BTC';
export const FIXTURE_BASE_CURRENCY = 'BRL';

/** Shared by every fixture transaction, so ledger order among them falls to recording order. */
export const FIXTURE_EXECUTED_AT = new Date('2026-01-05T13:00:00.000Z');

const FIXTURE_PORTFOLIO_NAME = 'Fixture Portfolio';
const FIXTURE_TRANSACTION_QUANTITY = 2;
const FIXTURE_TRANSACTION_UNIT_PRICE = 50_000;

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

export const createPortfolio = async (
  userId: string,
  overrides: Partial<
    Pick<Portfolio, 'name' | 'baseCurrency' | 'createdAt'>
  > = {}
) =>
  prismaClient.portfolio.create({
    data: {
      userId,
      name: FIXTURE_PORTFOLIO_NAME,
      baseCurrency: FIXTURE_BASE_CURRENCY,
      ...overrides
    }
  });

export const createInstrument = async (
  overrides: Partial<
    Pick<Instrument, 'symbol' | 'name' | 'type' | 'market' | 'currency'>
  > = {}
) =>
  prismaClient.instrument.create({
    data: {
      symbol: FIXTURE_ASSET_SYMBOL,
      name: 'Fixture Instrument',
      type: InstrumentTypes.CRYPTO,
      ...overrides
    }
  });

/**
 * Positions in one symbol share its catalog instrument, so the instrument is
 * registered by the first position in the symbol and reused by the others.
 */
export const createAsset = async ({
  portfolioId,
  symbol = FIXTURE_ASSET_SYMBOL,
  ...position
}: Pick<Position, 'portfolioId'> &
  Partial<
    Pick<Position, 'symbol' | 'quantity' | 'averageCost' | 'investedValue'>
  >) => {
  const { instrument, ...stored } = await prismaClient.position.create({
    data: {
      ...position,
      portfolio: { connect: { id: portfolioId } },
      instrument: {
        connectOrCreate: {
          where: { symbol },
          create: { symbol, name: symbol, type: InstrumentTypes.OTHER }
        }
      }
    },
    include: { instrument: true }
  });

  return { ...stored, symbol: instrument.symbol };
};

export const createTransaction = async (
  { portfolioId, instrumentId }: Pick<Position, 'portfolioId' | 'instrumentId'>,
  overrides: Partial<
    Pick<
      Transaction,
      | 'id'
      | 'type'
      | 'quantity'
      | 'unitPrice'
      | 'currency'
      | 'executedAt'
      | 'createdAt'
    >
  > = {}
) =>
  prismaClient.transaction.create({
    data: {
      portfolioId,
      instrumentId,
      type: TransactionTypes.BUY,
      quantity: String(FIXTURE_TRANSACTION_QUANTITY),
      unitPrice: String(FIXTURE_TRANSACTION_UNIT_PRICE),
      currency: FIXTURE_BASE_CURRENCY,
      executedAt: FIXTURE_EXECUTED_AT,
      ...overrides
    }
  });

/**
 * Smallest coherent graph the API can operate on: a user with a portfolio
 * holding one asset with one transaction. The position is stated explicitly
 * instead of derived from its transactions, so a fixture does not depend on
 * how the API derives it.
 */
export const seedPortfolio = async (
  overrides: { email?: string; symbol?: string } = {}
) => {
  const { email, symbol } = overrides;

  const user = await createUser(email ? { email } : {});
  const portfolio = await createPortfolio(user.id);

  const asset = await createAsset({
    portfolioId: portfolio.id,
    quantity: String(FIXTURE_TRANSACTION_QUANTITY),
    averageCost: String(FIXTURE_TRANSACTION_UNIT_PRICE),
    investedValue: String(
      FIXTURE_TRANSACTION_QUANTITY * FIXTURE_TRANSACTION_UNIT_PRICE
    ),
    ...(symbol && { symbol })
  });

  const transaction = await createTransaction(asset);

  return { user, portfolio, asset, transaction };
};
