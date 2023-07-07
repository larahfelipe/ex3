import { config } from 'dotenv';

config();

export const envs = {
  port: process.env.PORT || 8080,
  dbAccessUrl: process.env.DATABASE_URL,
  bcryptSalt: process.env.BCRYPT_SALT || 12,
  jwtSecret: process.env.JWT_SECRET || 'jwtSecret'
};
