import type { Position } from './Position';

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: string;
  positions: Array<Position>;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};
