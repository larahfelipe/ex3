import { config } from 'dotenv';

config();

export default {
  port: process.env.PORT || 4000,
  dbAccessUrl: process.env.DATABASE_URL
} as const;
