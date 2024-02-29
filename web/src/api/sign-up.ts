import { api } from '@/lib/axios';

export type SignUpPayload = {
  name: string;
  email: string;
  password: string;
};

export const signUp = async (payload: SignUpPayload) => {
  const res = await api.post('/v1/user/create', payload);

  return res.data;
};
