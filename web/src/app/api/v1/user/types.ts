import type { SignInResponseData } from '@/app/api/v1/sign-in';
import type { WithMessage } from '@/types';

export type GetCurrentUserResponseData = Record<'user', SignInResponseData>;

/** An empty last name clears it. */
export type UpdateProfileRequestPayload = Record<
  'firstName' | 'lastName',
  string
>;

export type ChangePasswordRequestPayload = Record<
  'oldPassword' | 'newPassword',
  string
>;

export type UpdateCurrentUserResponseData = GetCurrentUserResponseData &
  WithMessage;
