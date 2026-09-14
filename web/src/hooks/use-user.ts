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
import type { GetCurrentUserResponseData } from '@/app/api/v1/user';
import { APP_ROUTES } from '@/common/constants';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';

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
      toast.success(`Logged in as ${userData.name}`);
      push(APP_ROUTES.Protected.Assets);
    },
    onError: (e) => toast.error(e.message)
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
    onSuccess: ({ data }) => {
      const { message, user: userData } = data;
      queryClient.removeQueries();
      toast.success(message);
      toast.success(`Logged in as ${userData.name}`);
      push(APP_ROUTES.Protected.Assets);
    },
    onError: (e) => toast.error(e.message)
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();
  const { push } = useRouter();

  return useMutation<AxiosResponse<SignOutResponseData>>({
    mutationFn: () => api.getInstance().post('/v1/sign-out'),
    onSuccess: () => {
      queryClient.removeQueries();
      toast.success('Logged out successfully');
      push(APP_ROUTES.Public.SignIn);
    },
    onError: () => toast.error('Something went wrong. Please try again later')
  });
};
