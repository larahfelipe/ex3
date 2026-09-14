/* eslint-disable no-console */
import { app, envs } from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';

const bootstrap = async () => {
  try {
    const prismaClient = PrismaClient.getInstance();
    await prismaClient.makeConnection();
  } catch (e) {
    console.error(`\nError while connecting to database: ${e}`);
    process.exit(1);
  }

  if (envs.yahooFinanceApiKey === undefined)
    console.warn(
      '\nYAHOO_FINANCE_API_KEY is not set: every quote is reported as unavailable'
    );

  app.listen(envs.port, () =>
    console.log(`\nServer running on port ${envs.port}`)
  );
};

bootstrap();
