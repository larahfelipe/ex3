import { api } from '@/lib/axios';

import type { User } from './sign-in';

export type SignUpPayload = {
  name: string;
  email: string;
  password: string;
};

export type SignUpResponse = {
  user: User;
  message: string;
};

export const signUp = async (payload: SignUpPayload) =>
  await api.post<SignUpResponse>('/v1/user/create', payload);
