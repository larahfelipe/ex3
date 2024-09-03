'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type FC
} from 'react';

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
import { CURRENCIES, EX3_STORAGE_KEYS } from '@/common/constants';
import api, { type ApiErrorData } from '@/lib/axios';
import type { Children, Maybe } from '@/types';

type UserContextProps = {
  isLoading: boolean;
  isFetching: boolean;
  currency: keyof typeof CURRENCIES;
  user: Maybe<UserProperties>;
  changeCurrency: (currency: keyof typeof CURRENCIES) => void;
  signInMutation: UseMutateAsyncFunction<
    AxiosResponse<SignInResponseData>,
    ApiErrorData,
    SignInRequestPayload
  >;
  signUpMutation: UseMutateAsyncFunction<
    AxiosResponse<SignUpResponseData>,
    ApiErrorData,
    SignUpRequestPayload
  >;
  signOutMutation: UseMutateAsyncFunction<AxiosResponse<SignOutResponseData>>;
};

const UserContext = createContext({} as UserContextProps);

const UserProvider: FC<Readonly<Children>> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Maybe<SignInResponseData>>(null);
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>(
    CURRENCIES.BRL.id
  );

  const changeCurrency = (c: keyof typeof CURRENCIES) => setCurrency(c);

  const { mutateAsync: signInMutation, status: signInStatus } = useMutation<
    AxiosResponse<SignInResponseData>,
    ApiErrorData,
    SignInRequestPayload
  >({
    mutationFn: (payload) => api.client.post('/v1/sign-in', payload),
    onSuccess: ({ data: userData }) => {
      setUser(userData);
      localStorage.setItem(EX3_STORAGE_KEYS.User, JSON.stringify(userData));
      toast.success(`Logged in as ${userData.name}`);
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: signUpMutation, status: signUpStatus } = useMutation<
    AxiosResponse<SignUpResponseData>,
    ApiErrorData,
    SignUpRequestPayload
  >({
    mutationFn: (payload) => api.client.post('/v1/sign-up', payload),
    onSuccess: ({ data }) => {
      const { message, user: userData } = data;
      setUser(userData);
      localStorage.setItem(EX3_STORAGE_KEYS.User, JSON.stringify(userData));
      toast.success(message);
      toast.success(`Logged in as ${userData.name}`);
    },
    onError: (e) => toast.error(e.message)
  });

  const { mutateAsync: signOutMutation } = useMutation<
    AxiosResponse<SignOutResponseData>
  >({
    mutationFn: () => api.client.post('/v1/sign-out'),
    onSuccess: () => {
      setUser(null);
      localStorage.clear();
      toast.success('Logged out successfully');
    },
    onError: () => toast.error('Something went wrong. Please try again later')
  });

  const loadUserFromStorage = useCallback(() => {
    try {
      const maybeUser = localStorage.getItem(EX3_STORAGE_KEYS.User);
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

    loadUserFromStorage();
  }, [user, loadUserFromStorage]);

  return (
    <UserContext.Provider
      value={{
        changeCurrency,
        signInMutation,
        signUpMutation,
        signOutMutation,
        currency,
        user,
        isLoading,
        isFetching: signInStatus === 'pending' || signUpStatus === 'pending'
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export { UserContext, UserProvider };
