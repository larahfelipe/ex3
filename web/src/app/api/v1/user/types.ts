import type { SignInResponseData } from '@/app/api/v1/sign-in';
import type { Locale } from '@/i18n/config';
import type { WithMessage } from '@/types';

export type GetCurrentUserResponseData = Record<'user', SignInResponseData>;

export type UpdateProfileRequestPayload = Record<
  'firstName' | 'lastName',
  string
>;

export type UpdateLocaleRequestPayload = Record<'locale', Locale>;

export type ChangePasswordRequestPayload = Record<
  'oldPassword' | 'newPassword',
  string
>;

export type UpdateCurrentUserResponseData = GetCurrentUserResponseData &
  WithMessage;
