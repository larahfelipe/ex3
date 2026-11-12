'use client';

import { useMemo, useRef, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import { BOT_CHALLENGE } from '@/common/constants';
import {
  BotChallenge,
  type BotChallengeHandle
} from '@/components/bot-challenge';
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

type SignInFormProps = Record<'destination', string> &
  Record<'challengeSiteKey', string | undefined>;

export const SignInForm: FC<SignInFormProps> = ({
  destination,
  challengeSiteKey
}) => {
  const { mutateAsync: signIn } = useSignIn(destination);
  const challengeRef = useRef<BotChallengeHandle>(null);
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
      const challengeToken = (await challengeRef.current?.solve()) ?? null;

      await signIn({ payload: formData, challengeToken });
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isSignInField(path) ? path : undefined),
        t: tErrors
      });
    } finally {
      challengeRef.current?.reset();
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(handleSignIn)(event)}
    >
      <div className="space-y-4">
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

      <BotChallenge
        ref={challengeRef}
        siteKey={challengeSiteKey}
        action={BOT_CHALLENGE.Actions.SignIn}
      />

      <SubmitButton isPending={isSubmitting} size="lg" className="mt-6 w-full">
        {t('signIn.submit')}
      </SubmitButton>
    </form>
  );
};
