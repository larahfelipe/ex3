import { z } from 'zod';

/**
 * HS256 derives its security from the secret's entropy. 32 bytes matches the
 * digest size, below which the signature is weaker than the algorithm implies.
 */
const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Whoever holds it chooses the client address the API throttles a request
 * under, so it gets the entropy asked of the JWT secret.
 */
const API_PROXY_SECRET_MIN_LENGTH = 32;

const BCRYPT_SALT_MIN_ROUNDS = 10;

const DEFAULT_PORT = 8080;
const DEFAULT_BCRYPT_SALT = 12;
const DEFAULT_JWT_EXPIRATION = '1d';

/**
 * The unit is mandatory: jsonwebtoken reads a bare numeric string ("3600") as
 * milliseconds, which would silently shrink the lifetime a thousandfold.
 */
const TOKEN_LIFETIME_PATTERN = /^(?<quantity>[1-9]\d*)(?<unit>[smhd])$/;

const SECONDS_PER_DAY = 24 * 60 * 60;

const SECONDS_PER_UNIT: ReadonlyMap<string, number> = new Map([
  ['s', 1],
  ['m', 60],
  ['h', 60 * 60],
  ['d', SECONDS_PER_DAY]
]);

/**
 * NIST SP 800-63B bounds a password-authenticated (AAL1) session at 30 days
 * before reauthentication; a token living longer would outlast that bound.
 */
const MAX_TOKEN_LIFETIME_DAYS = 30;
const MAX_TOKEN_LIFETIME_SECONDS = MAX_TOKEN_LIFETIME_DAYS * SECONDS_PER_DAY;

const tokenLifetimeSeconds = z.string().transform((value, ctx) => {
  const lifetime = TOKEN_LIFETIME_PATTERN.exec(value)?.groups;
  const secondsPerUnit =
    lifetime === undefined ? undefined : SECONDS_PER_UNIT.get(lifetime.unit);

  if (lifetime === undefined || secondsPerUnit === undefined) {
    ctx.issues.push({
      code: 'custom',
      input: value,
      message: 'Must be a positive integer followed by s, m, h or d (e.g. 15m)'
    });
    return z.NEVER;
  }

  const seconds = Number(lifetime.quantity) * secondsPerUnit;

  if (seconds > MAX_TOKEN_LIFETIME_SECONDS) {
    ctx.issues.push({
      code: 'custom',
      input: value,
      message: `Must be at most ${MAX_TOKEN_LIFETIME_DAYS}d`
    });
    return z.NEVER;
  }

  return seconds;
});

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  )
  .pipe(
    z
      .array(z.url('Each origin must be a valid URL'))
      .min(1, 'At least one origin is required')
  );

/**
 * `.env.example` ships every optional key blank, so a copied file carries empty
 * strings. Without this they would be read as values — `PORT=` as the number
 * zero — and startup would fail on an environment that set nothing at all.
 */
const blankAsAbsent = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const EnvsSchema = z
  .object({
    NODE_ENV: blankAsAbsent(
      z.enum(['development', 'test', 'production']).default('development')
    ),
    PORT: blankAsAbsent(
      z.coerce.number().int().positive().default(DEFAULT_PORT)
    ),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: blankAsAbsent(z.string().min(1).optional()),
    BCRYPT_SALT: blankAsAbsent(
      z.coerce
        .number()
        .int()
        .min(
          BCRYPT_SALT_MIN_ROUNDS,
          `Must be at least ${BCRYPT_SALT_MIN_ROUNDS} rounds`
        )
        .default(DEFAULT_BCRYPT_SALT)
    ),
    JWT_SECRET: z
      .string({ error: 'JWT_SECRET is required' })
      .min(
        JWT_SECRET_MIN_LENGTH,
        `Must have at least ${JWT_SECRET_MIN_LENGTH} characters`
      ),
    JWT_EXPIRATION: blankAsAbsent(
      tokenLifetimeSeconds.prefault(DEFAULT_JWT_EXPIRATION)
    ),
    CORS_ALLOWED_ORIGINS: blankAsAbsent(originList.optional()),
    API_PROXY_SECRET: blankAsAbsent(
      z
        .string()
        .min(
          API_PROXY_SECRET_MIN_LENGTH,
          `Must have at least ${API_PROXY_SECRET_MIN_LENGTH} characters`
        )
        .optional()
    ),
    YAHOO_FINANCE_API_KEY: blankAsAbsent(z.string().optional())
  })
  .superRefine((envs, ctx) => {
    if (envs.NODE_ENV === 'production' && !envs.CORS_ALLOWED_ORIGINS?.length)
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'Required when NODE_ENV=production'
      });

    if (envs.NODE_ENV === 'production' && envs.API_PROXY_SECRET === undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['API_PROXY_SECRET'],
        message: 'Required when NODE_ENV=production'
      });
  })
  .transform((envs) => ({
    nodeEnv: envs.NODE_ENV,
    isProduction: envs.NODE_ENV === 'production',
    port: envs.PORT,
    dbAccessUrl: envs.DATABASE_URL,
    dbDirectUrl: envs.DIRECT_URL,
    bcryptSalt: envs.BCRYPT_SALT,
    jwtSecret: envs.JWT_SECRET,
    jwtExpirationSeconds: envs.JWT_EXPIRATION,
    corsAllowedOrigins: envs.CORS_ALLOWED_ORIGINS ?? [],
    apiProxySecret: envs.API_PROXY_SECRET,
    yahooFinanceApiKey: envs.YAHOO_FINANCE_API_KEY
  }));

export type Envs = z.infer<typeof EnvsSchema>;

export class EnvValidationError extends Error {
  readonly issues: ReadonlyArray<string>;

  constructor(issues: ReadonlyArray<string>) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export const parseEnvs = (source: NodeJS.ProcessEnv): Envs => {
  const result = EnvsSchema.safeParse(source);

  if (!result.success)
    throw new EnvValidationError(
      result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`
      )
    );

  return result.data;
};
