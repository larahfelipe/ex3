import { api } from '@/lib/axios';
import type { WithId } from '@/types';

type UserProperties = {
  name: string;
  email: string;
  accessToken: string;
  createdAt: string;
  updatedAt: string;
};

export interface User extends WithId, UserProperties {}

export type SignInPayload = {
  email: string;
  password: string;
};

export type SignInResponse = User;

export const signIn = async (payload: SignInPayload) =>
  await api.post<SignInResponse>('/v1/user', payload);
