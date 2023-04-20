import type { User } from '@/domain/models';

export type InputPayload = Pick<User, 'password'>;

export type DeleteUserResponse = {
  message: string | null;
};
