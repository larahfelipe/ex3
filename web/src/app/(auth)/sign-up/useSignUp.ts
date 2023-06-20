import { useCallback } from 'react';
import type { SubmitHandler } from 'react-hook-form';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/hooks';

import type { SignUpFormData } from './SignUp.types';

export const useSignUp = () => {
  const { user, isLoading, signUp } = useAuth();

  const { push } = useRouter();

  const signUpHandler: SubmitHandler<SignUpFormData> = useCallback(
    async (formData) => {
      const { name, email, password } = formData;

      await signUp({ name, email, password });

      push('/dashboard');
    },
    [signUp, push]
  );

  return {
    user,
    isLoading,
    signUpHandler
  };
};
