import { envs, InstrumentTypes, TransactionTypes } from '@/config';
import type {
  Instrument,
  Portfolio,
  Position,
  Transaction,
  User
} from '@/domain/models';
import { portfolioNameKey } from '@/domain/PortfolioName';
import { Bcrypt } from '@/infra/cryptography';
import { PrismaClient } from '@/infra/database/PrismaClient';

export const FIXTURE_PASSWORD = 'fixture-password';

export const FIXTURE_USER_EMAIL = 'holder@ex3.app';
export const FIXTURE_ASSET_SYMBOL = 'BTC';
export const FIXTURE_BASE_CURRENCY = 'BRL';

export const FIXTURE_EXECUTED_AT = new Date('2026-01-05T13:00:00.000Z');

export const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const FIXTURE_PORTFOLIO_NAME = 'Fixture Portfolio';
const FIXTURE_TRANSACTION_QUANTITY = 2;
const FIXTURE_TRANSACTION_UNIT_PRICE = 50_000;

const prismaClient = PrismaClient.getInstance();
const bcrypt = Bcrypt.getInstance(envs.bcryptSalt);

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
      firstName: 'Fixture',
      lastName: 'Holder',
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
) => {
  const { name = FIXTURE_PORTFOLIO_NAME, ...attributes } = overrides;

  return prismaClient.portfolio.create({
    data: {
      userId,
      name,
      nameKey: portfolioNameKey(name),
      baseCurrency: FIXTURE_BASE_CURRENCY,
      ...attributes
    }
  });
};

export const createInstrument = async (
  overrides: Partial<
    Pick<
      Instrument,
      'symbol' | 'name' | 'type' | 'market' | 'currency' | 'sector' | 'ownerId'
    >
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

export const createAsset = async ({
  portfolioId,
  symbol = FIXTURE_ASSET_SYMBOL,
  ...position
}: Pick<Position, 'portfolioId'> &
  Partial<
    Pick<Position, 'symbol' | 'quantity' | 'averageCost' | 'investedValue'>
  >) => {
  const instrument =
    (await prismaClient.instrument.findFirst({
      where: { symbol, ownerId: null }
    })) ??
    (await prismaClient.instrument.create({
      data: { symbol, name: symbol, type: InstrumentTypes.OTHER }
    }));

  const stored = await prismaClient.position.create({
    data: { ...position, portfolioId, instrumentId: instrument.id }
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
      | 'fees'
      | 'taxes'
      | 'currency'
      | 'executedAt'
      | 'broker'
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
