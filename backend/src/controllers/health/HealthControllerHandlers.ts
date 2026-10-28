import type { Request, RequestHandler, Response } from 'express';

import { Errors } from '@/config/Constants';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { LogSeverities, log, type LogSink } from '@/infra/observability';

const DATABASE_DEPENDENCY = 'database';

/** Resolves with why the database is unusable, or with nothing when it answers. */
export type DependencyProbe = () => Promise<string | undefined>;

const probeDatabase: DependencyProbe = async () => {
  try {
    await PrismaClient.getInstance().$queryRaw`SELECT 1`;

    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

/**
 * Liveness: the process is running and its event loop answers. It deliberately
 * touches no dependency — a restart cannot fix a database that is down, and an
 * orchestrator reading this as failure would restart a healthy instance.
 */
export const livenessControllerHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
};

/**
 * Readiness: the instance can serve a request that reads. The probe query runs
 * per call, because a cached flag would keep reporting the state of whichever
 * request happened to observe the database last.
 */
export const createReadinessControllerHandler =
  (
    probe: DependencyProbe = probeDatabase,
    logEntry: LogSink = log
  ): RequestHandler =>
  async (req, res) => {
    const reason = await probe();

    if (reason === undefined) {
      res.status(200).json({ status: 'ready', database: 'up' });

      return;
    }

    logEntry({
      severity: LogSeverities.WARNING,
      event: 'dependency_unavailable',
      dependency: DATABASE_DEPENDENCY,
      reason
    });

    req.errorCode = Errors.UNAVAILABLE.code;

    res.status(Errors.UNAVAILABLE.status).json({
      code: Errors.UNAVAILABLE.code,
      message: Errors.UNAVAILABLE.message,
      details: []
    });
  };

export const readinessControllerHandler = createReadinessControllerHandler();
