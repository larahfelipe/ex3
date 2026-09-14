import type { SignInResponseData } from '@/app/api/v1/sign-in';

export type GetCurrentUserResponseData = Record<
  'user',
  Omit<SignInResponseData, 'name'> & Record<'name', string | null>
>;
