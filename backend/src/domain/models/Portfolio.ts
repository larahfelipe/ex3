import type { Asset } from './Asset';

export type Portfolio = {
  id: string;
  userId: string;
  assets: Array<Asset>;
};
