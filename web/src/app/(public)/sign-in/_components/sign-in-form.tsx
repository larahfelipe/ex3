'use client';

import { useMemo, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui';
import { useSignIn } from '@/hooks/use-user';
import type { Translator } from '@/i18n/translator';
import { emailSchemaFor } from '@/lib/account-schema';
import { presentSubmitError } from '@/lib/submit-error';

import { AuthNotice } from '../../_components/auth-notice';

type SignInFormValues = z.infer<ReturnType<typeof signInSchemaFor>>;

const signInSchemaFor = (t: Translator<'validation'>) =>
  z.object({
    email: emailSchemaFor(t),
    password: z.string().min(1, t('password.required'))
  });

const SIGN_IN_FIELDS = ['email', 'password'] as const satisfies ReadonlyArray<
  keyof SignInFormValues
>;

const isSignInField = (path: string): path is keyof SignInFormValues =>
  SIGN_IN_FIELDS.some((field) => field === path);

type SignInFormProps = Record<'destination', string>;

export const SignInForm: FC<SignInFormProps> = ({ destination }) => {
  const { mutateAsync: signIn } = useSignIn(destination);
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const signInSchema = useMemo(
    () => signInSchemaFor(tValidation),
    [tValidation]
  );

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
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
        fieldOf: (path) => (isSignInField(path) ? path : undefined),
        t: tErrors
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(handleSignIn)}>
      <div className="space-y-5">
        <FormField label={t('fields.email')} error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="username"
              {...register('email', { onChange: () => void trigger('email') })}
            />
          )}
        </FormField>

        <FormField
          label={t('fields.password')}
          error={errors.password?.message}
        >
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
        {t('signIn.submit')}
      </SubmitButton>
    </form>
  );
};
