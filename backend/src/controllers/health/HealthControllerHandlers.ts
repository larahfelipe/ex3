import type { Request, RequestHandler, Response } from 'express';

import { Errors } from '@/config/Constants';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { log, LogSeverities, type LogSink } from '@/infra/observability';

const DATABASE_DEPENDENCY = 'database';

export type DependencyProbe = () => Promise<string | undefined>;

const probeDatabase: DependencyProbe = async () => {
  try {
    await PrismaClient.getInstance().$queryRaw`SELECT 1`;

    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

export const livenessControllerHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
};

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
