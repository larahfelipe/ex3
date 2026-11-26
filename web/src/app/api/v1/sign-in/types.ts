import type { WithId, WithTimestamps } from '@/types';

export type WithAccessToken = Record<'accessToken', string>;

export type UserProperties = {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  locale: string | null;
};

export type User = WithId & WithAccessToken & WithTimestamps & UserProperties;

export type SignInRequestPayload = {
  email: string;
  password: string;
};

export type SignInResponseData = UserProperties & WithId & WithTimestamps;
