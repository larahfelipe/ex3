import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient as _PrismaClient } from '@prisma/client';
import { isDriverAdapterError } from '@prisma/driver-adapter-utils';

import { envs } from '@/config/Envs';
import { LogSeverities, log } from '@/infra/observability';

/**
 * Prisma's code, and the driver adapter's error kind, for a transaction Postgres
 * aborted over a write conflict or a deadlock. Which of the two surfaces depends
 * on the statement the abort interrupts.
 */
const TRANSACTION_WRITE_CONFLICT = 'P2034';
const ADAPTER_WRITE_CONFLICT = 'TransactionWriteConflict';

/** Prisma's code for a write rejected by a unique index. */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Assumed, not measured: a conflict needs a concurrent write to the same rows,
 * so a third failure in a row is contention worth surfacing, not retrying.
 */
const SERIALIZABLE_MAX_ATTEMPTS = 3;

export class PrismaClient extends _PrismaClient {
  private static INSTANCE: PrismaClient;
  private _isConnected: boolean;

  private constructor() {
    super({ adapter: new PrismaPg({ connectionString: envs.dbAccessUrl }) });
    this._isConnected = false;
  }

  static getInstance() {
    if (!PrismaClient.INSTANCE) PrismaClient.INSTANCE = new PrismaClient();

    return PrismaClient.INSTANCE;
  }

  static isUniqueConstraintViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    );
  }

  private static isWriteConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return error.code === TRANSACTION_WRITE_CONFLICT;

    return (
      error instanceof Error &&
      isDriverAdapterError(error) &&
      error.cause.kind === ADAPTER_WRITE_CONFLICT
    );
  }

  isConnected() {
    return this._isConnected;
  }

  /**
   * Runs `operation` in a serializable transaction: a check it makes against the
   * rows it read cannot be invalidated by a concurrent write before it commits.
   * Postgres resolves a conflict by aborting one side, which is rerun from the
   * start, so `operation` must touch nothing but the transaction client.
   */
  async runSerializable<Result>(
    operation: (transactionClient: Prisma.TransactionClient) => Promise<Result>
  ): Promise<Result> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        const isRetryableConflict =
          PrismaClient.isWriteConflict(error) &&
          attempt < SERIALIZABLE_MAX_ATTEMPTS;

        if (!isRetryableConflict) throw error;
      }
    }
  }

  /**
   * With a driver adapter `$connect` only sets the pool up, so it resolves even
   * when the database is unreachable. The probe query is what makes the startup
   * check fail fast.
   */
  async makeConnection() {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;

    this._isConnected = true;
    log({ severity: LogSeverities.INFO, event: 'database_connected' });
  }
}
