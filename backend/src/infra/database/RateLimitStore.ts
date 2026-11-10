import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';

import { UnavailableError } from '@/errors';
import {
  log,
  LogSeverities,
  type LogEntry,
  type LogSink
} from '@/infra/observability';

import { PrismaClient } from './PrismaClient';

type Operation = Extract<
  LogEntry,
  { event: 'rate_limit_store_failed' }
>['operation'];

type CounterRow = { hits: number; resetAt: Date };

const MS_PER_SECOND = 1000;

/** Assumed, not measured: often enough that expired counters stay few. */
const SWEEP_INTERVAL_MS = 10 * 60 * MS_PER_SECOND;

const toRateLimitInfo = ({ hits, resetAt }: CounterRow) => ({
  totalHits: hits,
  resetTime: resetAt
});

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Keeps an `express-rate-limit` budget in Postgres, so every API process counts
 * against the same counters. A window opens with the first hit of a key and
 * closes `windowMs` later on the database clock, which every process shares; an
 * insert that meets an existing key takes its row lock, so concurrent hits are
 * counted one after another and none is lost.
 *
 * A store that cannot count refuses the request with 503 instead of letting it
 * through uncounted. The one exception is giving back a hit: a failed
 * decrement leaves the attempt counted, which errs against the caller.
 */
export class RateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 0;
  private sweepTimer: NodeJS.Timeout | undefined;
  private readonly prismaClient: PrismaClient;
  private readonly logEntry: LogSink;

  constructor({
    prefix,
    prismaClient = PrismaClient.getInstance(),
    logEntry = log
  }: RateLimitStore.Options) {
    this.prefix = `${prefix}:`;
    this.prismaClient = prismaClient;
    this.logEntry = logEntry;
  }

  init({ windowMs }: Pick<Options, 'windowMs'>) {
    this.windowMs = windowMs;
    this.sweepTimer ??= setInterval(
      () => void this.sweep().catch(() => undefined),
      SWEEP_INTERVAL_MS
    ).unref();
  }

  async increment(key: string) {
    const [counter] = await this.run('increment', () => {
      const counterKey = this.prefix + key;
      const windowSeconds = this.windowMs / MS_PER_SECOND;

      return this.prismaClient.$queryRaw<CounterRow[]>`
        INSERT INTO "rate_limit_counters" ("key", "hits", "resetAt")
        VALUES (${counterKey}, 1, now() + make_interval(secs => ${windowSeconds}))
        ON CONFLICT ("key") DO UPDATE SET
          "hits" = CASE
            WHEN "rate_limit_counters"."resetAt" <= now() THEN 1
            ELSE "rate_limit_counters"."hits" + 1
          END,
          "resetAt" = CASE
            WHEN "rate_limit_counters"."resetAt" <= now() THEN EXCLUDED."resetAt"
            ELSE "rate_limit_counters"."resetAt"
          END
        RETURNING "hits", "resetAt"
      `;
    });

    if (!counter) throw new UnavailableError();

    return toRateLimitInfo(counter);
  }

  async decrement(key: string) {
    await this.run(
      'decrement',
      () => this.prismaClient.$executeRaw`
        UPDATE "rate_limit_counters"
        SET "hits" = GREATEST("hits" - 1, 0)
        WHERE "key" = ${this.prefix + key} AND "resetAt" > now()
      `
    ).catch(() => undefined);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const [counter] = await this.run(
      'get',
      () => this.prismaClient.$queryRaw<CounterRow[]>`
        SELECT "hits", "resetAt"
        FROM "rate_limit_counters"
        WHERE "key" = ${this.prefix + key} AND "resetAt" > now()
      `
    );

    return counter && toRateLimitInfo(counter);
  }

  async resetKey(key: string) {
    await this.run(
      'reset',
      () => this.prismaClient.$executeRaw`
        DELETE FROM "rate_limit_counters" WHERE "key" = ${this.prefix + key}
      `
    );
  }

  async resetAll() {
    await this.run(
      'reset',
      () => this.prismaClient.$executeRaw`
        DELETE FROM "rate_limit_counters" WHERE starts_with("key", ${this.prefix})
      `
    );
  }

  shutdown() {
    clearInterval(this.sweepTimer);
    this.sweepTimer = undefined;
  }

  /** Counters whose window closed answer nothing, so removing them is upkeep. */
  async sweep() {
    await this.run(
      'sweep',
      () => this.prismaClient.$executeRaw`
        DELETE FROM "rate_limit_counters"
        WHERE "resetAt" <= now() AND starts_with("key", ${this.prefix})
      `
    );
  }

  private async run<Result>(
    operation: Operation,
    query: () => Promise<Result>
  ) {
    try {
      return await query();
    } catch (error) {
      this.logEntry({
        severity: LogSeverities.ERROR,
        event: 'rate_limit_store_failed',
        operation,
        reason: reasonOf(error)
      });

      throw new UnavailableError();
    }
  }
}

export namespace RateLimitStore {
  export type Options = {
    /** Unique per limiter: two limiters that share one count each other's hits. */
    prefix: string;
    prismaClient?: PrismaClient;
    logEntry?: LogSink;
  };
}
