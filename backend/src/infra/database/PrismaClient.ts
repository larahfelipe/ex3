/* eslint-disable no-console */
import { PrismaClient as _PrismaClient } from '@prisma/client';

import { envs } from '@/config';

export class PrismaClient extends _PrismaClient {
  private static INSTANCE: PrismaClient;
  private _isConnected: boolean;

  private constructor() {
    super();
    this._isConnected = false;
  }

  static getInstance() {
    if (!PrismaClient.INSTANCE) PrismaClient.INSTANCE = new PrismaClient();

    return PrismaClient.INSTANCE;
  }

  isConnected() {
    return this._isConnected;
  }

  async makeConnection() {
    if (!envs.dbAccessUrl)
      throw new Error('\nMissing database URL in .env file');

    try {
      await this.$connect();

      this._isConnected = true;
      console.log('\nConnection to database established');
    } catch (e) {
      console.error(e);
    }
  }
}
