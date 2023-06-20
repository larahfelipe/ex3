import type { ReactNode } from 'react';

export type AuthContextProps = {
  isLoading: boolean;
  user: User | null;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signOut: () => void;
};

export type AuthProviderProps = Record<'children', ReactNode>;

export type SignInPayload = Record<'email' | 'password', string>;

export type SignUpPayload = SignInPayload & Record<'name', string>;

export type User = {
  id: string;
  name: string | null;
  email: string;
  accessToken?: string;
  isStaff: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SignInResponse = User & Record<'message', string>;

export type SignUpResponse = {
  user: User;
  message: string;
};
