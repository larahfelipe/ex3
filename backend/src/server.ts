import { PrismaClient, envs } from '@/config';

import { app } from './app';

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
