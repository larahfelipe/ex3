import 'dotenv/config';

import { defineConfig } from 'prisma/config';

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
