import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { envs } from '@/config';

import { assertDatabaseReachable, disconnectDatabase } from './TestDatabase';

const PRISMA_CLI_ENTRY = 'prisma/build/index.js';

const UNREACHABLE_DATABASE_HINT = [
  'Cannot reach the test database at DATABASE_URL (see .env.test).',
  'Start it with: pnpm test:db:up'
].join('\n');

class TestDatabaseSetupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TestDatabaseSetupError';
  }
}

const applyMigrations = () => {
  const cliEntry = createRequire(__filename).resolve(PRISMA_CLI_ENTRY);

  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [cliEntry, 'migrate', 'deploy'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: envs.dbAccessUrl,
        DIRECT_URL: envs.dbAccessUrl
      }
    }
  );

  if (status !== 0)
    throw new TestDatabaseSetupError(
      `prisma migrate deploy exited with ${status}\n${stdout}${stderr}`
    );
};

const prepare = async () => {
  try {
    await assertDatabaseReachable();
  } catch (e) {
    throw new TestDatabaseSetupError(UNREACHABLE_DATABASE_HINT, { cause: e });
  }

  applyMigrations();
};

prepare()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
