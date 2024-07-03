import type { WithId, WithTimestamps } from '@/types';

export type WithAccessToken = Record<'accessToken', string>;

export type UserProperties = {
  name: string;
  email: string;
};

export interface User
  extends WithId,
    WithAccessToken,
    WithTimestamps,
    UserProperties {}

export type SignInRequestPayload = {
  email: string;
  password: string;
};

export interface SignInResponseData
  extends UserProperties,
    WithId,
    WithTimestamps {}
