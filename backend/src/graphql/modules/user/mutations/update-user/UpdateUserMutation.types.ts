import type { UserEssentials } from '@/types';

export type InputPayload = {
  name: string;
  oldPassword: string | null;
  newPassword: string | null;
};

export type UpdateUserResponse = {
  user: UserEssentials | null;
  message: string | null;
};
