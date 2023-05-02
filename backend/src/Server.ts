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

  app.listen(envs.port, () =>
    console.log(`\nServer running on port ${envs.port}`)
  );
};

bootstrap();
