import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'test') config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/infra/database/SeedDevelopmentCatalog.ts'
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
  }
});
