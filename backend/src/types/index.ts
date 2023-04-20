import type { User } from '@/domain/models';

export type UserEssentials = Omit<User, 'password'>;

export type Context = {
  user: User | null;
  message: string | null;
};
