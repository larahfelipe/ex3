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
  UpdateProfileRequestPayload
} from '@/app/api/v1/user';
import { APP_ROUTES } from '@/common/constants';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';
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

/** The public layout drops the cached queries once the protected pages have unmounted. */
const useLeaveSession = () => {
  const { push } = useRouter();

  return (message: string) => {
    selectActivePortfolio(null);
    toast.success(message);
    push(APP_ROUTES.Public.SignIn);
  };
};

export const useSignIn = (destination: string) => {
  const { push } = useRouter();
  const t = useTranslations('auth.signIn');

  return useMutation<
    AxiosResponse<SignInResponseData>,
    ApiProxyErrorData,
    SignInRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-in', payload),
    onSuccess: ({ data: userData }) => {
      toast.success(t('welcome', { name: userData.name ?? userData.email }));
      push(destination);
    }
  });
};

export const useSignUp = () => {
  const { push } = useRouter();
  const t = useTranslations('auth.signUp');

  return useMutation<
    AxiosResponse<SignUpResponseData>,
    ApiProxyErrorData,
    SignUpRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-up', payload),
    onSuccess: ({ data: { user: userData } }) => {
      toast.success(t('welcome', { name: userData.name ?? userData.email }));
      push(APP_ROUTES.Protected.Overview);
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

/**
 * The new name shows everywhere as soon as it is submitted: the form checks it
 * by the API's own rule, so a refusal is rare, and renaming again undoes it.
 * A failure restores the name the cache held and asks the API for the one it
 * kept, since a request that timed out may still have applied. On success the
 * response already carries the saved profile, so nothing is fetched again.
 */
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
    onMutate: async ({ name }) => {
      await queryClient.cancelQueries({ queryKey: currentUserKey });

      const previousUser =
        queryClient.getQueryData<CurrentUserResponse>(currentUserKey);

      if (previousUser)
        queryClient.setQueryData<CurrentUserResponse>(currentUserKey, {
          ...previousUser,
          data: { user: { ...previousUser.data.user, name } }
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

/** The API revokes the session that changed the password, and the proxy clears its cookie in the same response. */
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
