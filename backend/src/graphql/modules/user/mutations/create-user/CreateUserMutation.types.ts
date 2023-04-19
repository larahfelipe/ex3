import type { User } from '@/domain/models';

type UserEssentials = Omit<User, 'password'>;

export type CreateUserResponse = {
  user: UserEssentials | null;
  success: string | null;
  error: string | null;
};
