'use client';

import { type FC } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type SubmitHandler
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { CURRENCIES } from '@/common/constants';
import { FormField } from '@/components/form-field';
import { PasswordRequirements } from '@/components/password-requirements';
import { SubmitButton } from '@/components/submit-button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useSignUp } from '@/hooks/use-user';
import {
  AccountNameSchema,
  EmailSchema,
  isDerivedFromEmail,
  NewPasswordSchema,
  PASSWORD_DERIVED_FROM_EMAIL_MESSAGE
} from '@/lib/account-schema';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import { presentSubmitError } from '@/lib/submit-error';

import { AuthNotice } from '../../_components/auth-notice';

type SignUpFormValues = z.infer<typeof signUpSchema>;

const CURRENCY_IDS = Object.values(CURRENCIES).map(({ id }) => id);

const signUpSchema = z
  .object({
    name: AccountNameSchema,
    email: EmailSchema,
    password: NewPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    baseCurrency: z.enum(CURRENCY_IDS, 'Select a valid base currency')
  })
  .refine(({ email, password }) => !isDerivedFromEmail(password, email), {
    message: PASSWORD_DERIVED_FROM_EMAIL_MESSAGE,
    path: ['password']
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

const SIGN_UP_FIELDS = signUpSchema.keyof().options;

const isSignUpField = (path: string): path is keyof SignUpFormValues =>
  SIGN_UP_FIELDS.some((field) => field === path);

export const SignUpForm: FC = () => {
  const { mutateAsync: signUp } = useSignUp();

  const {
    control: formControl,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<SignUpFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      baseCurrency: CURRENCIES.BRL.id
    }
  });

  const [email, password] = useWatch({
    control: formControl,
    name: ['email', 'password']
  });

  const handleSignUp: SubmitHandler<SignUpFormValues> = async ({
    name,
    email,
    password,
    baseCurrency
  }) => {
    try {
      await signUp({ name, email, password, baseCurrency });
    } catch (error) {
      if (error instanceof ApiProxyError && isConflictError(error)) {
        setError(
          'email',
          {
            type: 'server',
            message: 'This email is already registered. Sign in instead.'
          },
          { shouldFocus: true }
        );
        return;
      }

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isSignUpField(path) ? path : undefined)
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(handleSignUp)}>
      <div className="space-y-5">
        <FormField label="Name" error={errors.name?.message}>
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              autoCorrect="off"
              {...register('name')}
            />
          )}
        </FormField>

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

        <FormField
          label="Password"
          hint={<PasswordRequirements password={password} email={email} />}
          error={errors.password?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          )}
        </FormField>

        <FormField
          label="Confirm password"
          error={errors.confirmPassword?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          )}
        </FormField>

        <FormField
          label="Base currency"
          hint="Your first portfolio reports in this currency."
          error={errors.baseCurrency?.message}
        >
          {({ required, ...control }) => (
            <Controller
              name="baseCurrency"
              control={formControl}
              render={({ field }) => (
                <Select
                  required={required}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    {...control}
                    className="w-full"
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>

                  <SelectContent>
                    {Object.values(CURRENCIES).map(({ id, name, symbol }) => (
                      <SelectItem key={id} value={id}>
                        {`${name} (${symbol})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
        Create account
      </SubmitButton>
    </form>
  );
};
