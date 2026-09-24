import { useRouter } from 'next/navigation';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

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
import api, {
  type ApiProxyErrorData,
  UNEXPECTED_ERROR_MESSAGE
} from '@/lib/axios';
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

  return useMutation<
    AxiosResponse<SignInResponseData>,
    ApiProxyErrorData,
    SignInRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-in', payload),
    onSuccess: ({ data: userData }) => {
      toast.success(`Signed in as ${userData.name ?? userData.email}`);
      push(destination);
    }
  });
};

export const useSignUp = () => {
  const { push } = useRouter();

  return useMutation<
    AxiosResponse<SignUpResponseData>,
    ApiProxyErrorData,
    SignUpRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-up', payload),
    onSuccess: ({ data: { user: userData } }) => {
      toast.success(
        `Account created. Signed in as ${userData.name ?? userData.email}`
      );
      push(APP_ROUTES.Protected.Overview);
    }
  });
};

export const useSignOut = () => {
  const leaveSession = useLeaveSession();

  return useMutation<AxiosResponse<SignOutResponseData>>({
    mutationFn: () => api.getInstance().post('/v1/sign-out'),
    onSuccess: () => leaveSession('Signed out'),
    onError: () => toast.error(UNEXPECTED_ERROR_MESSAGE)
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
      toast.success(data.message);
    }
  });
};

/** The API revokes the session that changed the password, and the proxy clears its cookie in the same response. */
export const useChangePassword = () => {
  const leaveSession = useLeaveSession();

  return useMutation<
    AxiosResponse<UpdateCurrentUserResponseData>,
    ApiProxyErrorData,
    ChangePasswordRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().patch('/v1/user', payload),
    onSuccess: () =>
      leaveSession('Password changed. Sign in with your new password')
  });
};
