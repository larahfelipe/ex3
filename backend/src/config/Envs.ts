import { config } from 'dotenv';

import { parseEnvs } from './EnvsSchema';

config({ quiet: true });

export const envs = parseEnvs(process.env);
