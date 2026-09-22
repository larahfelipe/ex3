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

/** Nothing cached for the account that is leaving may reach the next one to sign in. */
const useLeaveSession = () => {
  const queryClient = useQueryClient();
  const { push } = useRouter();

  return (message: string) => {
    selectActivePortfolio(null);
    queryClient.removeQueries();
    toast.success(message);
    push(APP_ROUTES.Public.SignIn);
  };
};

export const useSignIn = () => {
  const queryClient = useQueryClient();
  const { push } = useRouter();

  return useMutation<
    AxiosResponse<SignInResponseData>,
    ApiProxyErrorData,
    SignInRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-in', payload),
    onSuccess: ({ data: userData }) => {
      queryClient.removeQueries();
      toast.success(`Signed in as ${userData.name ?? userData.email}`);
      push(APP_ROUTES.Protected.Overview);
    }
  });
};

export const useSignUp = () => {
  const queryClient = useQueryClient();
  const { push } = useRouter();

  return useMutation<
    AxiosResponse<SignUpResponseData>,
    ApiProxyErrorData,
    SignUpRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().post('/v1/sign-up', payload),
    onSuccess: ({ data: { user: userData } }) => {
      queryClient.removeQueries();
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

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation<
    AxiosResponse<UpdateCurrentUserResponseData>,
    ApiProxyErrorData,
    UpdateProfileRequestPayload
  >({
    mutationFn: (payload) => api.getInstance().patch('/v1/user', payload),
    onSuccess: async ({ data }) => {
      toast.success(data.message);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.currentUser()
      });
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
