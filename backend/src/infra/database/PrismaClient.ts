import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as _PrismaClient, Prisma } from '@prisma/client';
import { isDriverAdapterError } from '@prisma/driver-adapter-utils';

import { envs } from '@/config/Envs';
import { log, LogSeverities } from '@/infra/observability';

const TRANSACTION_WRITE_CONFLICT = 'P2034';
const ADAPTER_WRITE_CONFLICT = 'TransactionWriteConflict';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

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

  async runSerializable<Result>(
    operation: (transactionClient: Prisma.TransactionClient) => Promise<Result>,
    { timeout }: Partial<Record<'timeout', number>> = {}
  ): Promise<Result> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          ...(timeout !== undefined && { timeout })
        });
      } catch (error) {
        const isRetryableConflict =
          PrismaClient.isWriteConflict(error) &&
          attempt < SERIALIZABLE_MAX_ATTEMPTS;

        if (!isRetryableConflict) throw error;
      }
    }
  }

  async makeConnection() {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;

    this._isConnected = true;
    log({ severity: LogSeverities.INFO, event: 'database_connected' });
  }
}
