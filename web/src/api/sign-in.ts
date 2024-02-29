import { api } from '@/lib/axios';

export type SignInPayload = {
  email: string;
  password: string;
};

export const signIn = async (payload: SignInPayload) =>
  await api.post('/v1/user', payload);
