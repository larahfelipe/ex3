import type { Asset } from './Asset';

export type Portfolio = {
  id: string;
  assets: Array<Asset>;
  userId: string;
};
