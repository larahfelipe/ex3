import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const VALID_JWT_SECRET = 'a'.repeat(32);
const VALID_DATABASE_URL = 'postgresql://user:pass@localhost:5432/ex3';

/**
 * dotenv never overrides variables already present in the environment, so
 * passing them explicitly keeps this test deterministic whether or not the
 * developer has a local `.env`.
 */
const loadEnvsModule = (envs: NodeJS.ProcessEnv) =>
  execFileAsync(
    process.execPath,
    ['--import', 'tsx', '-e', "require('./src/config/Envs');"],
    { cwd: process.cwd(), env: { PATH: process.env.PATH, ...envs } }
  );

describe('envs startup', () => {
  it('starts up with a valid environment', async () => {
    const { stderr } = await loadEnvsModule({
      DATABASE_URL: VALID_DATABASE_URL,
      JWT_SECRET: VALID_JWT_SECRET
    });

    assert.equal(stderr, '');
  });

  it('fails startup when JWT_SECRET is absent', async () => {
    await assert.rejects(
      loadEnvsModule({ DATABASE_URL: VALID_DATABASE_URL, JWT_SECRET: '' }),
      (e: Error & { stderr: string }) => {
        assert.match(e.stderr, /EnvValidationError/);
        assert.match(e.stderr, /JWT_SECRET/);
        return true;
      }
    );
  });

  it('has no hard-coded JWT secret fallback', async () => {
    await assert.rejects(
      loadEnvsModule({ DATABASE_URL: VALID_DATABASE_URL, JWT_SECRET: '' }),
      (e: Error & { stdout: string }) => {
        assert.equal(e.stdout, '');
        return true;
      }
    );
  });
});
