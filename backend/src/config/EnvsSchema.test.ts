import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EnvValidationError, parseEnvs } from './EnvsSchema';

const VALID_JWT_SECRET = 'a'.repeat(32);
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/** Mirrors the token lifetime ceiling in `EnvsSchema`. */
const MAX_TOKEN_LIFETIME_SECONDS = 30 * SECONDS_PER_DAY;

const validEnvs: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/ex3',
  JWT_SECRET: VALID_JWT_SECRET
};

const expectIssue = (source: NodeJS.ProcessEnv, expectedIssue: string) => {
  assert.throws(
    () => parseEnvs(source),
    (e: unknown) => {
      assert.ok(e instanceof EnvValidationError);
      assert.ok(
        e.issues.some((issue) => issue.includes(expectedIssue)),
        `expected an issue matching "${expectedIssue}", got ${JSON.stringify(e.issues)}`
      );
      return true;
    }
  );
};

describe('parseEnvs', () => {
  it('accepts a minimal valid environment', () => {
    const envs = parseEnvs(validEnvs);

    assert.equal(envs.jwtSecret, VALID_JWT_SECRET);
    assert.equal(envs.dbAccessUrl, validEnvs.DATABASE_URL);
  });

  it('applies documented defaults for optional values', () => {
    const envs = parseEnvs(validEnvs);

    assert.equal(envs.nodeEnv, 'development');
    assert.equal(envs.isProduction, false);
    assert.equal(envs.port, 8080);
    assert.equal(envs.bcryptSalt, 12);
    assert.equal(envs.jwtExpirationSeconds, SECONDS_PER_DAY);
    assert.deepEqual(envs.corsAllowedOrigins, []);
  });

  it('rejects a missing JWT_SECRET', () => {
    expectIssue({ DATABASE_URL: validEnvs.DATABASE_URL }, 'JWT_SECRET');
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expectIssue({ ...validEnvs, JWT_SECRET: 'jwtSecret' }, 'JWT_SECRET');
  });

  it('rejects a missing DATABASE_URL', () => {
    expectIssue({ JWT_SECRET: VALID_JWT_SECRET }, 'DATABASE_URL');
  });

  it('reports every invalid variable at once', () => {
    assert.throws(
      () => parseEnvs({}),
      (e: unknown) => {
        assert.ok(e instanceof EnvValidationError);
        assert.equal(e.issues.length, 2);
        return true;
      }
    );
  });

  it('coerces numeric values from their string representation', () => {
    const envs = parseEnvs({ ...validEnvs, PORT: '3333', BCRYPT_SALT: '14' });

    assert.equal(envs.port, 3333);
    assert.equal(envs.bcryptSalt, 14);
  });

  it('rejects a bcrypt cost factor below the minimum', () => {
    expectIssue({ ...validEnvs, BCRYPT_SALT: '4' }, 'BCRYPT_SALT');
  });

  it('converts JWT_EXPIRATION into seconds for every supported unit', () => {
    const lifetimes = new Map([
      ['45s', 45],
      ['15m', 15 * SECONDS_PER_MINUTE],
      ['12h', 12 * SECONDS_PER_HOUR],
      ['7d', 7 * SECONDS_PER_DAY]
    ]);

    for (const [JWT_EXPIRATION, seconds] of lifetimes)
      assert.equal(
        parseEnvs({ ...validEnvs, JWT_EXPIRATION }).jwtExpirationSeconds,
        seconds
      );
  });

  it('rejects a JWT_EXPIRATION without a supported unit', () => {
    for (const JWT_EXPIRATION of ['', '3600', '1w', '1.5h', ' 1h', '1h '])
      expectIssue({ ...validEnvs, JWT_EXPIRATION }, 'JWT_EXPIRATION');
  });

  it('rejects a JWT_EXPIRATION that is not positive', () => {
    for (const JWT_EXPIRATION of ['0s', '-1h', '00h'])
      expectIssue({ ...validEnvs, JWT_EXPIRATION }, 'JWT_EXPIRATION');
  });

  it('accepts a JWT_EXPIRATION at the ceiling, whatever the unit', () => {
    for (const JWT_EXPIRATION of [
      '30d',
      '720h',
      `${MAX_TOKEN_LIFETIME_SECONDS}s`
    ])
      assert.equal(
        parseEnvs({ ...validEnvs, JWT_EXPIRATION }).jwtExpirationSeconds,
        MAX_TOKEN_LIFETIME_SECONDS
      );
  });

  it('rejects a JWT_EXPIRATION beyond the ceiling', () => {
    for (const JWT_EXPIRATION of [
      '31d',
      '721h',
      `${MAX_TOKEN_LIFETIME_SECONDS + 1}s`,
      `${Number.MAX_SAFE_INTEGER}d`
    ])
      expectIssue({ ...validEnvs, JWT_EXPIRATION }, 'JWT_EXPIRATION');
  });

  it('parses CORS_ALLOWED_ORIGINS into a list of origins', () => {
    const envs = parseEnvs({
      ...validEnvs,
      CORS_ALLOWED_ORIGINS: 'https://ex3.app, https://staging.ex3.app'
    });

    assert.deepEqual(envs.corsAllowedOrigins, [
      'https://ex3.app',
      'https://staging.ex3.app'
    ]);
  });

  it('rejects a malformed origin', () => {
    expectIssue(
      { ...validEnvs, CORS_ALLOWED_ORIGINS: 'not-a-url' },
      'CORS_ALLOWED_ORIGINS'
    );
  });

  it('requires CORS_ALLOWED_ORIGINS in production', () => {
    expectIssue(
      { ...validEnvs, NODE_ENV: 'production' },
      'CORS_ALLOWED_ORIGINS'
    );
  });

  it('accepts a complete production environment', () => {
    const envs = parseEnvs({
      ...validEnvs,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://ex3.app'
    });

    assert.equal(envs.isProduction, true);
    assert.equal(envs.yahooFinanceApiKey, undefined);
  });

  it('leaves the market data key unset when it is blank', () => {
    const envs = parseEnvs({ ...validEnvs, YAHOO_FINANCE_API_KEY: '' });

    assert.equal(envs.yahooFinanceApiKey, undefined);
  });

  it('reads the market data key when it is set', () => {
    const envs = parseEnvs({
      ...validEnvs,
      YAHOO_FINANCE_API_KEY: 'yahoo-finance-api-key'
    });

    assert.equal(envs.yahooFinanceApiKey, 'yahoo-finance-api-key');
  });
});
