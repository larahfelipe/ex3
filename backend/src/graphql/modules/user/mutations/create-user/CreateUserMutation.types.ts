import type { User } from '@/domain/models';
import type { UserEssentials } from '@/types';

export type InputPayload = Pick<User, 'name' | 'email' | 'password'>;

export type CreateUserResponse = {
  user: UserEssentials | null;
  message: string | null;
};
