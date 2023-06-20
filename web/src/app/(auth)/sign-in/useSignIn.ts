import { useCallback } from 'react';
import type { SubmitHandler } from 'react-hook-form';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/hooks';

import type { SignInFormData } from './SignIn.types';

export const useSignIn = () => {
  const { user, isLoading, signIn } = useAuth();

  const { push } = useRouter();

  const signInHandler: SubmitHandler<SignInFormData> = useCallback(
    async (formData) => {
      await signIn(formData);

      push('/dashboard');
    },
    [signIn, push]
  );

  return {
    user,
    isLoading,
    signInHandler
  };
};
