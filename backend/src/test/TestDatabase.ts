import type { Prisma } from '@prisma/client';
import type { TestContext } from 'node:test';

import { PrismaClient } from '@/infra/database/PrismaClient';

/**
 * Prisma's own bookkeeping table records which migrations were applied. Wiping
 * it would make every run reapply the whole history against a populated schema.
 */
const MIGRATIONS_TABLE = '_prisma_migrations';

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

/**
 * Empties every data table so each test observes the rows it created and
 * nothing else. The table list is read from the catalog rather than hardcoded,
 * so tables added by later migrations are covered without editing this file.
 *
 * Identifiers cannot be bound as query parameters, hence the interpolated
 * statement: the names come from the test database's own catalog, never from
 * test input.
 */
export const resetDatabase = async () => {
  const tables = await listDataTables();

  if (!tables.length) return;

  const targets = tables
    .map((table) => `"public".${quoteIdentifier(table)}`)
    .join(', ');

  await prismaClient.$executeRawUnsafe(
    `TRUNCATE TABLE ${targets} RESTART IDENTITY CASCADE`
  );
};

/**
 * Resolves only when the connection is usable. The driver adapter builds the
 * pool lazily, so a probe query is the only way to tell an unreachable database
 * from a healthy one.
 */
export const assertDatabaseReachable = async () => {
  await prismaClient.$queryRaw`SELECT 1`;
};

export const disconnectDatabase = () => prismaClient.$disconnect();

/**
 * Until the test ends, `model.action` rejects inside `runSerializable` after the
 * steps before it have written, so whatever a failed request leaves behind is
 * what the transaction did not undo. Every other query runs as usual. The
 * prototype is mocked because the client instance is a proxy on which
 * `mock.method` does not find the method.
 */
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
