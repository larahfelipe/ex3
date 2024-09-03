import type { WithId, WithMessage, WithTimestamps } from '@/types';

import type { UserProperties } from '../sign-in';

export type SignUpRequestPayload = {
  name: string;
  email: string;
  password: string;
};

export interface SignUpResponseData extends WithMessage {
  user: UserProperties & WithId & WithTimestamps;
}
