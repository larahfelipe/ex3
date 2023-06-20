import { createContext, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import type { AxiosResponse } from 'axios';

import { envs } from '@/config';
import { api } from '@/services';

import type {
  AuthContextProps,
  AuthProviderProps,
  SignInPayload,
  SignInResponse,
  SignUpPayload,
  SignUpResponse,
  User
} from './AuthProvider.types';

export const AuthContext = createContext({} as AuthContextProps);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState({} as User);

  const signIn = useCallback(async (payload: SignInPayload) => {
    try {
      setIsLoading(true);

      const { data }: AxiosResponse<SignInResponse> = await api.post(
        '/v1/user',
        payload
      );

      const [accessToken, userData] = (({ accessToken, ...userData }) => [
        accessToken,
        userData
      ])(data) as [string, User];

      setUser(userData);
      localStorage.setItem(envs.userStorageKey, JSON.stringify(userData));
      localStorage.setItem(envs.accessTokenStorageKey, accessToken);

      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      toast.success(`Authenticated as ${userData.name ?? userData.email}`);
    } catch (e) {
      const { message } = e as Record<'message', string>;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    try {
      setIsLoading(true);

      const { data }: AxiosResponse<SignUpResponse> = await api.post(
        '/v1/user/create',
        payload
      );

      const [accessToken, userData] = (({ accessToken, ...userData }) => [
        accessToken,
        userData
      ])(data.user) as [string, User];

      setUser(userData);
      localStorage.setItem(envs.userStorageKey, JSON.stringify(userData));
      localStorage.setItem(envs.accessTokenStorageKey, accessToken);

      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      toast.success(`Authenticated as ${userData.name ?? userData.email}`);
    } catch (e) {
      const { message } = e as Record<'message', string>;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = () => {
    setUser({} as User);

    localStorage.removeItem(envs.userStorageKey);
    localStorage.removeItem(envs.accessTokenStorageKey);

    api.defaults.headers.common.Authorization = '';

    toast.success('Signed out successfully');
  };

  const loadLocalStorageData = useCallback(async () => {
    const accessToken = localStorage.getItem(envs.accessTokenStorageKey);
    const rawUser = localStorage.getItem(envs.userStorageKey);

    if (accessToken)
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

    if (rawUser) {
      const parsedUser: User = await JSON.parse(rawUser);
      setUser(parsedUser);
    }
  }, []);

  useEffect(() => void loadLocalStorageData(), [loadLocalStorageData]);

  return (
    <AuthContext.Provider value={{ isLoading, user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
