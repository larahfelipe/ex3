import { config } from 'dotenv';

import { parseEnvs } from './EnvsSchema';

/**
 * Under test the environment is the one `--env-file=.env.test` declares. Layering
 * the developer's `.env` under it would let a value the suite never declared —
 * a remote database, a real API key — decide what a test run reaches.
 */
if (process.env.NODE_ENV !== 'test') config({ quiet: true });

export const envs = parseEnvs(process.env);
