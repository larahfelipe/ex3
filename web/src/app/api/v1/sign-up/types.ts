import type { WithId, WithMessage, WithTimestamps } from '@/types';

import type { User, UserProperties } from '../sign-in';

export type SignUpRequestPayload = {
  name: string;
  email: string;
  password: string;
  baseCurrency: string;
};

export type SignUpApiResponseData = WithMessage & Record<'user', User>;

export type SignUpResponseData = WithMessage &
  Record<'user', UserProperties & WithId & WithTimestamps>;
