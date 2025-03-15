'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC
} from 'react';

import { useRouter } from 'next/navigation';

import {
  useMutation,
  type UseMutateAsyncFunction
} from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import type {
  SignInRequestPayload,
  SignInResponseData,
  UserProperties
} from '@/app/api/v1/sign-in';
import type { SignOutResponseData } from '@/app/api/v1/sign-out';
import type {
  SignUpRequestPayload,
  SignUpResponseData
} from '@/app/api/v1/sign-up';
import { APP_ROUTES, APP_STORAGE_KEYS, CURRENCIES } from '@/common/constants';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryClient } from '@/lib/react-query';
import type { Children, Maybe } from '@/types';

type UserContextProps = {
  isLoading: boolean;
  isFetching: boolean;
  currency: keyof typeof CURRENCIES;
  user: Maybe<UserProperties>;
  changeCurrency: (currency: keyof typeof CURRENCIES) => void;
  signInMutationFn: UseMutateAsyncFunction<
    AxiosResponse<SignInResponseData>,
    ApiProxyErrorData,
    SignInRequestPayload
  >;
  signUpMutationFn: UseMutateAsyncFunction<
    AxiosResponse<SignUpResponseData>,
    ApiProxyErrorData,
    SignUpRequestPayload
  >;
  signOutMutationFn: UseMutateAsyncFunction<AxiosResponse<SignOutResponseData>>;
};

export const UserContext = createContext({} as UserContextProps);

export const UserProvider: FC<Children> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Maybe<SignInResponseData>>(null);
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>(
    CURRENCIES.BRL.id
  );

  const { push } = useRouter();

  const changeCurrency = useCallback(
    (c: keyof typeof CURRENCIES) => setCurrency(c),
    []
  );

  const { mutateAsync: signInMutationFn, status: signInMutationStatus } =
    useMutation<
      AxiosResponse<SignInResponseData>,
      ApiProxyErrorData,
      SignInRequestPayload
    >({
      mutationFn: (payload) => api.getInstance().post('/v1/sign-in', payload),
      onSuccess: ({ data: userData }) => {
        setUser(userData);
        localStorage.setItem(APP_STORAGE_KEYS.User, JSON.stringify(userData));
        toast.success(`Logged in as ${userData.name}`);
        push(APP_ROUTES.Protected.Assets);
      },
      onError: (e) => toast.error(e.message)
    });

  const { mutateAsync: signUpMutationFn, status: signUpMutationStatus } =
    useMutation<
      AxiosResponse<SignUpResponseData>,
      ApiProxyErrorData,
      SignUpRequestPayload
    >({
      mutationFn: (payload) => api.getInstance().post('/v1/sign-up', payload),
      onSuccess: ({ data }) => {
        const { message, user: userData } = data;
        setUser(userData);
        localStorage.setItem(APP_STORAGE_KEYS.User, JSON.stringify(userData));
        toast.success(message);
        toast.success(`Logged in as ${userData.name}`);
        push(APP_ROUTES.Protected.Assets);
      },
      onError: (e) => toast.error(e.message)
    });

  const { mutateAsync: signOutMutationFn } = useMutation<
    AxiosResponse<SignOutResponseData>
  >({
    mutationFn: () => api.getInstance().post('/v1/sign-out'),
    onSuccess: async () => {
      setUser(null);
      localStorage.clear();
      await queryClient.invalidateQueries({ refetchType: 'none' });
      toast.success('Logged out successfully');
      push(APP_ROUTES.Public.SignIn);
    },
    onError: () => toast.error('Something went wrong. Please try again later')
  });

  const loadDataFromStorage = useCallback(() => {
    try {
      const maybeUser = localStorage.getItem(APP_STORAGE_KEYS.User);
      if (maybeUser) {
        const userData: SignInResponseData = JSON.parse(maybeUser);
        setUser(userData);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      setIsLoading(false);
      return;
    }

    loadDataFromStorage();
  }, [user, loadDataFromStorage]);

  const value = useMemo(
    () => ({
      changeCurrency,
      signInMutationFn,
      signUpMutationFn,
      signOutMutationFn,
      currency,
      user,
      isLoading,
      isFetching:
        signInMutationStatus === 'pending' || signUpMutationStatus === 'pending'
    }),
    [
      changeCurrency,
      signInMutationFn,
      signUpMutationFn,
      signOutMutationFn,
      currency,
      user,
      isLoading,
      signInMutationStatus,
      signUpMutationStatus
    ]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
