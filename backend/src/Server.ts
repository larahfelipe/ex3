import { app, envs } from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { LogSeverities, log } from '@/infra/observability';

const bootstrap = async () => {
  try {
    const prismaClient = PrismaClient.getInstance();
    await prismaClient.makeConnection();
  } catch (e) {
    log({
      severity: LogSeverities.ERROR,
      event: 'database_unreachable',
      reason: e instanceof Error ? e.message : String(e)
    });
    process.exit(1);
  }

  if (envs.yahooFinanceApiKey === undefined)
    log({
      severity: LogSeverities.WARNING,
      event: 'quote_provider_key_missing'
    });

  app.listen(envs.port, () =>
    log({
      severity: LogSeverities.INFO,
      event: 'server_started',
      port: envs.port
    })
  );
};

bootstrap();
