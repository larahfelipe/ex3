import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

/** The suite declares its own environment; see `src/config/Envs.ts`. */
if (process.env.NODE_ENV !== 'test') config({ quiet: true });

/**
 * Prisma 7 no longer reads connection URLs from the schema: the CLI takes them
 * from here and the runtime takes them from the driver adapter. `DIRECT_URL`
 * bypasses a connection pooler, which is what migrations require.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
  }
});
