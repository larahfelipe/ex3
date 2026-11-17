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

const SWEEP_INTERVAL_MS = 10 * 60 * MS_PER_SECOND;

const toRateLimitInfo = ({ hits, resetAt }: CounterRow) => ({
  totalHits: hits,
  resetTime: resetAt
});

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
    prefix: string;
    prismaClient?: PrismaClient;
    logEntry?: LogSink;
  };
}
