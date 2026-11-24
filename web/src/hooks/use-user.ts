import { createElement } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type {
  SignInRequestPayload,
  SignInResponseData
} from '@/app/api/v1/sign-in';
import type { SignOutResponseData } from '@/app/api/v1/sign-out';
import type {
  SignUpRequestPayload,
  SignUpResponseData
} from '@/app/api/v1/sign-up';
import type {
  ChangePasswordRequestPayload,
  GetCurrentUserResponseData,
  UpdateCurrentUserResponseData,
  UpdateLocaleRequestPayload,
  UpdateProfileRequestPayload
} from '@/app/api/v1/user';
import { APP_ROUTES } from '@/common/constants';
import { isSupportedLocale, type Locale } from '@/i18n/config';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import {
  botChallengeHeaders,
  type ChallengedRequest
} from '@/lib/bot-challenge';
import { fullName } from '@/lib/person-name';
import { queryKeys } from '@/lib/react-query';
import { useLocaleSwitch } from '@/providers/locale-provider';
import type { Maybe } from '@/types';

import { selectActivePortfolio } from './use-portfolio';

export const useCurrentUser = () =>
  useQuery<
    AxiosResponse<GetCurrentUserResponseData>,
    ApiProxyErrorData,
    GetCurrentUserResponseData['user']
  >({
    queryKey: queryKeys.currentUser(),
    queryFn: () => api.getInstance().get('/v1/user'),
    select: ({ data }) => data.user
  });

const useLeaveSession = () => {
  const router = useRouter();

  return (message: string) => {
    selectActivePortfolio(null);
    toast.success(message);
    router.push(APP_ROUTES.Public.SignIn);
  };
};

const SignInWelcome = ({ name }: Record<'name', string>) =>
  useTranslations('auth.signIn')('welcome', { name });

export const useSignIn = (destination: string) => {
  const router = useRouter();
  const { switchLocale } = useLocaleSwitch();

  return useMutation<
    AxiosResponse<SignInResponseData>,
    ApiProxyErrorData,
    ChallengedRequest<SignInRequestPayload>
  >({
    mutationFn: ({ payload, challengeToken }) =>
      api.getInstance().post('/v1/sign-in', payload, {
        headers: botChallengeHeaders(challengeToken)
      }),
    onSuccess: async ({ data: userData }) => {
      if (isSupportedLocale(userData.locale))
        await switchLocale(userData.locale).catch(() => undefined);

      toast.success(
        createElement(SignInWelcome, {
          name: userData.name ?? userData.email
        })
      );
      router.push(destination);
    }
  });
};

export const useSignUp = () => {
  const router = useRouter();
  const t = useTranslations('auth.signUp');

  return useMutation<
    AxiosResponse<SignUpResponseData>,
    ApiProxyErrorData,
    ChallengedRequest<SignUpRequestPayload>
  >({
    mutationFn: ({ payload, challengeToken }) =>
      api.getInstance().post('/v1/sign-up', payload, {
        headers: botChallengeHeaders(challengeToken)
      }),
    onSuccess: ({ data: { user: userData } }) => {
      toast.success(t('welcome', { name: userData.name ?? userData.email }));
      router.push(APP_ROUTES.Protected.Overview);
    }
  });
};

export const useSignOut = () => {
  const leaveSession = useLeaveSession();
  const t = useTranslations('auth.signOut');

  return useMutation<AxiosResponse<SignOutResponseData>>({
    mutationFn: () => api.getInstance().post('/v1/sign-out'),
    onSuccess: () => leaveSession(t('done')),
    onError: () => toast.error(t('failed'))
  });
};

type CurrentUserResponse = AxiosResponse<GetCurrentUserResponseData>;

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const currentUserKey = queryKeys.currentUser();
  const t = useTranslations('account.profile');

  return useMutation<
    AxiosResponse<UpdateCurrentUserResponseData>,
    ApiProxyErrorData,
    UpdateProfileRequestPayload,
    Maybe<CurrentUserResponse>
  >({
    mutationFn: (payload) => api.getInstance().patch('/v1/user', payload),
    onMutate: async ({ firstName, lastName }) => {
      await queryClient.cancelQueries({ queryKey: currentUserKey });

      const previousUser =
        queryClient.getQueryData<CurrentUserResponse>(currentUserKey);

      if (previousUser)
        queryClient.setQueryData<CurrentUserResponse>(currentUserKey, {
          ...previousUser,
          data: {
            user: {
              ...previousUser.data.user,
              firstName,
              lastName: lastName === '' ? null : lastName,
              name: fullName(firstName, lastName)
            }
          }
        });

      return previousUser;
    },
    onError: (_error, _payload, previousUser) => {
      if (previousUser)
        queryClient.setQueryData<CurrentUserResponse>(
          currentUserKey,
          previousUser
        );

      void queryClient.invalidateQueries({ queryKey: currentUserKey });
    },
    onSuccess: ({ data }) => {
      queryClient.setQueryData<CurrentUserResponse>(
        currentUserKey,
        (current) => current && { ...current, data: { user: data.user } }
      );
      toast.success(t('saved'));
    }
  });
};

const LOCALE_SAVES = { id: 'user-locale' };

export const useSaveLocale = () => {
  const queryClient = useQueryClient();

  return useMutation<
    AxiosResponse<UpdateCurrentUserResponseData>,
    ApiProxyErrorData,
    Locale
  >({
    scope: LOCALE_SAVES,
    mutationFn: (locale) =>
      api
        .getInstance()
        .patch('/v1/user', { locale } satisfies UpdateLocaleRequestPayload),
    onSuccess: ({ data }) =>
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) => current && { ...current, data: { user: data.user } }
      )
  });
};

export const useChangePassword = () => {
  const leaveSession = useLeaveSession();
  const t = useTranslations('account.security');

  return useMutation<
    AxiosResponse<UpdateCurrentUserResponseData>,
    ApiProxyErrorData,
    ChangePasswordRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().patch('/v1/user', payload),
    onSuccess: () => leaveSession(t('changed'))
  });
};
