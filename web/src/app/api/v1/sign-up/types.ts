import type { WithId, WithMessage, WithTimestamps } from '@/types';

import type { User, UserProperties } from '../sign-in';

export type SignUpRequestPayload = {
  name: string;
  email: string;
  password: string;
  baseCurrency: string;
};

export interface SignUpApiResponseData extends WithMessage {
  user: User;
}

export interface SignUpResponseData extends WithMessage {
  user: UserProperties & WithId & WithTimestamps;
}
