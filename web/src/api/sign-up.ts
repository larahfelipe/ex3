import { api } from '@/lib/axios';
import type { WithMessage } from '@/types';

import type { User } from './sign-in';

export type SignUpPayload = {
  name: string;
  email: string;
  password: string;
};

export interface SignUpResponse extends WithMessage {
  user: User;
}

export const signUp = async (payload: SignUpPayload) =>
  await api.post<SignUpResponse>('/v1/user/create', payload);
