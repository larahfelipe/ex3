import type { User } from '@/domain/models';

export type Context = {
  user: User | null;
  message: string | null;
};
