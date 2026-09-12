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
