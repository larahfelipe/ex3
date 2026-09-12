import type { Portfolio } from './Portfolio';

export type User = {
  id: string;
  name: string | null;
  email: string;
  password: string;
  sessionVersion: number;
  isAdmin: boolean;
  portfolio: Portfolio;
  createdAt: Date;
  updatedAt: Date;
};
