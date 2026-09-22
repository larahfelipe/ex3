import type { SignInResponseData } from '@/app/api/v1/sign-in';
import type { WithMessage } from '@/types';

export type GetCurrentUserResponseData = Record<'user', SignInResponseData>;

export type UpdateProfileRequestPayload = Record<'name', string>;

export type ChangePasswordRequestPayload = Record<
  'oldPassword' | 'newPassword',
  string
>;

export type UpdateCurrentUserResponseData = GetCurrentUserResponseData &
  WithMessage;
