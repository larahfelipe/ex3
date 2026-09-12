import type { Asset } from './Asset';

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: string;
  assets: Array<Asset>;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};
