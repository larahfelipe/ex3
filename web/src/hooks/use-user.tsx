'use client';

import { createContext, useContext, useState, type FC } from 'react';

import { useMutation } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';

import { signIn as signInFn, type SignInPayload } from '@/api/sign-in';
import { signUp as signUpFn, type SignUpPayload } from '@/api/sign-up';
import type { Children, Maybe, MutationAsync, WithId } from '@/types';

type UserProperties = {
  name: string;
  email: string;
  isStaff: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface User extends WithId, UserProperties {}

type SignInResult = Record<'user', User & Record<'accessToken', string>>;

type SignUpResult = SignInResult & Record<'message', string>;

type UserContextProps = {
  user: Maybe<User>;
  signIn: MutationAsync<SignInPayload, SignInResult>;
  signUp: MutationAsync<SignUpPayload, SignInResult>;
};

const UserContext = createContext({} as UserContextProps);

export const UserProvider: FC<Readonly<Children>> = ({ children }) => {
  const [user, setUser] = useState<Maybe<User>>(null);

  const { mutateAsync: signIn } = useMutation({
    mutationFn: signInFn,
    onSuccess: ({ data }: AxiosResponse<SignInResult>) => {
      const { user } = data;
      setUser(user);
      localStorage.setItem('ex3@user', JSON.stringify(user));
      localStorage.setItem('ex3@accessToken', user.accessToken);
      toast.success(`Logged in as ${user.name}`);
    },
    onError: (e: string) => toast.error(e)
  });

  const { mutateAsync: signUp } = useMutation({
    mutationFn: signUpFn,
    onSuccess: ({ data }: AxiosResponse<SignUpResult>) => {
      const { user } = data;
      setUser(user);
      localStorage.setItem('ex3@user', JSON.stringify(user));
      localStorage.setItem('ex3@accessToken', user.accessToken);
      toast.success('User created successfully');
    },
    onError: (e: string) => toast.error(e)
  });

  return (
    <UserContext.Provider value={{ user, signIn, signUp }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);

  return ctx;
};
