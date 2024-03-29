import type { Portfolio } from './Portfolio';

export type User = {
  id: string;
  name: string | null;
  email: string;
  password: string;
  accessToken: string | null;
  isAdmin: boolean;
  portfolio: Portfolio;
  createdAt: Date;
  updatedAt: Date;
};
