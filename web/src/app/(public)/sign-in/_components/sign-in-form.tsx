'use client';

import { type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui';
import { useSignIn } from '@/hooks/use-user';
import { EmailSchema } from '@/lib/account-schema';
import { presentSubmitError } from '@/lib/submit-error';

import { AuthNotice } from '../../_components/auth-notice';

type SignInFormValues = z.infer<typeof signInSchema>;

const signInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required')
});

const SIGN_IN_FIELDS = signInSchema.keyof().options;

const isSignInField = (path: string): path is keyof SignInFormValues =>
  SIGN_IN_FIELDS.some((field) => field === path);

type SignInFormProps = Record<'destination', string>;

export const SignInForm: FC<SignInFormProps> = ({ destination }) => {
  const { mutateAsync: signIn } = useSignIn(destination);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const handleSignIn: SubmitHandler<SignInFormValues> = async (formData) => {
    try {
      await signIn(formData);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isSignInField(path) ? path : undefined)
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(handleSignIn)}>
      <div className="space-y-5">
        <FormField label="Email" error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="username"
              {...register('email')}
            />
          )}
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
          )}
        </FormField>

        {errors.root?.server?.message !== undefined && (
          <AuthNotice tone="negative" role="alert">
            {errors.root.server.message}
          </AuthNotice>
        )}
      </div>

      <SubmitButton isPending={isSubmitting} size="lg" className="mt-8 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
};
