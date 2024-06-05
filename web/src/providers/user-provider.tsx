'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC
} from 'react';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  signIn,
  type SignInPayload,
  type SignInResponse,
  type User
} from '@/api/sign-in';
import { signUp, type SignUpPayload, type SignUpResponse } from '@/api/sign-up';
import { CURRENCIES } from '@/common/constants';
import { api } from '@/lib/axios';
import type { Children, Maybe, MutationAsync } from '@/types';

type UserContextProps = {
  isLoading: boolean;
  isFetching: boolean;
  currency: keyof typeof CURRENCIES;
  user: Maybe<User>;
  changeCurrency: (currency: keyof typeof CURRENCIES) => void;
  signIn: MutationAsync<SignInPayload, SignInResponse>;
  signUp: MutationAsync<SignUpPayload, SignUpResponse>;
  signOut: () => void;
};

const EX3_USER_STORAGE_KEY = 'ex3@user';

const UserContext = createContext({} as UserContextProps);

const UserProvider: FC<Readonly<Children>> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Maybe<User>>(null);
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>(
    CURRENCIES.BRL.id
  );

  const changeCurrency = useCallback(
    (c: keyof typeof CURRENCIES) => setCurrency(c),
    []
  );

  const { mutateAsync: signInMutation, status: signInStatus } = useMutation({
    mutationFn: signIn,
    onSuccess: ({ data: userData }) => {
      setUser(userData);
      api.defaults.headers.Authorization = `Bearer ${userData.accessToken}`;
      localStorage.setItem(EX3_USER_STORAGE_KEY, JSON.stringify(userData));
      toast.success(`Logged in as ${userData.name}`);
    },
    onError: (e: string) => toast.error(e)
  });

  const { mutateAsync: signUpMutation, status: signUpStatus } = useMutation({
    mutationFn: signUp,
    onSuccess: ({ data }) => {
      const { message, user: userData } = data;
      setUser(userData);
      api.defaults.headers.Authorization = `Bearer ${userData.accessToken}`;
      localStorage.setItem(EX3_USER_STORAGE_KEY, JSON.stringify(userData));
      toast.success(message);
      toast.success(`Logged in as ${userData.name}`);
    },
    onError: (e: string) => toast.error(e)
  });

  const signOut = useCallback(() => {
    setUser(null);
    api.defaults.headers.Authorization = null;
    localStorage.clear();
    toast.success('Logged out successfully');
  }, []);

  const loadUserFromStorage = useCallback(() => {
    try {
      const maybeUser = localStorage.getItem(EX3_USER_STORAGE_KEY);
      if (maybeUser) {
        const userData: User = JSON.parse(maybeUser);
        api.defaults.headers.Authorization = `Bearer ${userData.accessToken}`;
        setUser(userData);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const memoizedValues = useMemo(
    () => ({
      currency,
      user,
      changeCurrency,
      signIn: signInMutation,
      signUp: signUpMutation,
      signOut,
      isLoading,
      isFetching: signInStatus === 'pending' || signUpStatus === 'pending'
    }),
    [
      currency,
      user,
      changeCurrency,
      signInMutation,
      signUpMutation,
      signOut,
      isLoading,
      signInStatus,
      signUpStatus
    ]
  );

  useEffect(() => {
    if (user?.id) {
      setIsLoading(false);
      return;
    }

    loadUserFromStorage();
  }, [user, loadUserFromStorage]);

  return (
    <UserContext.Provider value={memoizedValues}>
      {children}
    </UserContext.Provider>
  );
};

export { UserContext, UserProvider };
