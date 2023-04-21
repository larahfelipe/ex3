import type { Portfolio } from './Portfolio';

export type User = {
  id: string;
  name: string | null;
  email: string;
  password: string;
  accessToken: string | null;
  portfolio: Portfolio;
  createdAt: Date;
  updatedAt: Date;
};
