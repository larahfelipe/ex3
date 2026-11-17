import type { Prisma } from '@prisma/client';
import type { TestContext } from 'node:test';

import { envs } from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';

const MIGRATIONS_TABLE = '_prisma_migrations';

const TEST_ENVIRONMENT = 'test';

class NonTestDatabaseResetError extends Error {
  constructor() {
    super(
      `Refusing to empty the database while NODE_ENV is ${envs.nodeEnv}: the process environment overrides .env.test`
    );
    this.name = 'NonTestDatabaseResetError';
  }
}

const prismaClient = PrismaClient.getInstance();

const quoteIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

const listDataTables = async () => {
  const rows = await prismaClient.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> ${MIGRATIONS_TABLE}
  `;

  return rows.map(({ tablename }) => tablename);
};

export const resetDatabase = async () => {
  if (envs.nodeEnv !== TEST_ENVIRONMENT) throw new NonTestDatabaseResetError();

  const tables = await listDataTables();

  if (!tables.length) return;

  const targets = tables
    .map((table) => `"public".${quoteIdentifier(table)}`)
    .join(', ');

  await prismaClient.$executeRawUnsafe(
    `TRUNCATE TABLE ${targets} RESTART IDENTITY CASCADE`
  );
};

export const assertDatabaseReachable = async () => {
  await prismaClient.$queryRaw`SELECT 1`;
};

export const disconnectDatabase = () => prismaClient.$disconnect();

export const injectWriteFailure = <
  Model extends Uncapitalize<Prisma.ModelName>
>(
  t: TestContext,
  model: Model,
  action: Extract<keyof Prisma.TransactionClient[Model], string>
) => {
  const failure = new Error(`injected failure on ${model}.${action}`);
  const runSerializable = prismaClient.runSerializable.bind(prismaClient);

  const failingAtAction = (transactionClient: Prisma.TransactionClient) =>
    new Proxy(transactionClient, {
      get: (client, property) =>
        property === model
          ? new Proxy(client[model], {
              get: (delegate, name) =>
                name === action
                  ? () => Promise.reject(failure)
                  : Reflect.get(delegate, name)
            })
          : Reflect.get(client, property)
    });

  t.mock.method(
    PrismaClient.prototype,
    'runSerializable',
    (
      operation: (
        transactionClient: Prisma.TransactionClient
      ) => Promise<unknown>
    ) =>
      runSerializable((transactionClient) =>
        operation(failingAtAction(transactionClient))
      )
  );

  return failure;
};
