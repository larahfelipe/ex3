'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC
} from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import { signIn as signInFn, type SignInPayload } from '@/api/sign-in';
import { signUp as signUpFn, type SignUpPayload } from '@/api/sign-up';
import { CURRENCIES } from '@/common/constants';
import { api } from '@/lib/axios';
import type { Children, Maybe, MutationAsync, WithId } from '@/types';

type UserProperties = {
  name: string;
  email: string;
  accessToken: string;
  isStaff: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface User extends WithId, UserProperties {}

type SignInResult = User;

type SignUpResult = {
  user: User;
  message: string;
};

type UserContextProps = {
  isLoading: boolean;
  currency: keyof typeof CURRENCIES;
  user: Maybe<User>;
  changeCurrency: (currency: keyof typeof CURRENCIES) => void;
  signIn: MutationAsync<SignInPayload, SignInResult>;
  signUp: MutationAsync<SignUpPayload, SignUpResult>;
  signOut: () => void;
};

const EX3_USER_STORAGE_KEY = 'ex3@user';

const UserContext = createContext({} as UserContextProps);

export const UserProvider: FC<Readonly<Children>> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Maybe<User>>(null);
  const [currency, setCurrency] = useState<keyof typeof CURRENCIES>(
    CURRENCIES.BRL.id
  );

  const { push } = useRouter();

  const changeCurrency = useCallback(
    (c: keyof typeof CURRENCIES) => setCurrency(c),
    []
  );

  const { mutateAsync: signIn, status: signInStatus } = useMutation({
    mutationFn: signInFn,
    onSuccess: ({ data: userData }: AxiosResponse<SignInResult>) => {
      setUser(userData);
      api.defaults.headers.Authorization = `Bearer ${userData.accessToken}`;
      localStorage.setItem(EX3_USER_STORAGE_KEY, JSON.stringify(userData));
      toast.success(`Logged in as ${userData.name}`);
    },
    onError: (e: string) => toast.error(e)
  });

  const { mutateAsync: signUp, status: signUpStatus } = useMutation({
    mutationFn: signUpFn,
    onSuccess: ({ data }: AxiosResponse<SignUpResult>) => {
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
    push('/sign-in');
    toast.success('Logged out successfully');
  }, [push]);

  const loadUserFromStorage = useCallback(() => {
    const maybeUser = localStorage.getItem(EX3_USER_STORAGE_KEY);
    if (maybeUser) {
      const userData: User = JSON.parse(maybeUser);
      api.defaults.headers.Authorization = `Bearer ${userData.accessToken}`;
      setUser(userData);
    }
    setIsLoading(false);
  }, []);

  const memoizedValues = useMemo(
    () => ({
      currency,
      user,
      changeCurrency,
      signIn,
      signUp,
      signOut,
      isLoading:
        isLoading || signInStatus === 'pending' || signUpStatus === 'pending'
    }),
    [
      currency,
      user,
      changeCurrency,
      signIn,
      signUp,
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

export const useUser = () => {
  const ctx = useContext(UserContext);

  return ctx;
};
