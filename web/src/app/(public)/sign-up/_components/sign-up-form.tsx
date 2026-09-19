/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { type FC } from 'react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { CURRENCIES } from '@/common/constants';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useSignUp } from '@/hooks/use-user';
import { withSettledRejection } from '@/lib/utils';

type SignUpFormValues = z.infer<typeof signUpSchema>;

/**
 * Mirror of the API's new-password policy, so the form flags violations before
 * submitting; the API stays authoritative. Passwords are never trimmed.
 */
const PASSWORD_MIN_CODE_POINTS = 15;
const PASSWORD_MAX_BYTES = 72;

const utf8Encoder = new TextEncoder();

const CURRENCY_IDS = Object.values(CURRENCIES).map(({ id }) => id);

const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(6, 'Name must be at least 6 characters long')
      .max(255, 'Name must be at most 255 characters long'),
    email: z.string().trim().email(),
    password: z
      .string()
      .refine(
        (value) => [...value].length >= PASSWORD_MIN_CODE_POINTS,
        `Password must be at least ${PASSWORD_MIN_CODE_POINTS} characters long`
      )
      .refine(
        (value) => utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_BYTES,
        `Password must be at most ${PASSWORD_MAX_BYTES} bytes long`
      )
      .refine((value) => value.trim().length > 0, 'Password must not be blank'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
    baseCurrency: z.enum(CURRENCY_IDS, 'Select a valid base currency')
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  });

export const SignUpForm: FC = () => {
  const { mutateAsync: signUpMutationFn } = useSignUp();

  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignUpFormValues>({
    mode: 'onChange',
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      baseCurrency: CURRENCIES.BRL.id
    }
  });

  const handleSignUp: SubmitHandler<SignUpFormValues> = async ({
    confirmPassword,
    ...formData
  }) => {
    await signUpMutationFn(formData);
    reset();
  };

  return (
    <form onSubmit={withSettledRejection(handleSubmit(handleSignUp))}>
      <div className="flex-col align-center space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>

          <Input
            id="name"
            disabled={isSubmitting}
            autoCorrect="off"
            {...register('name')}
          />

          {!!errors.name?.message && (
            <small className="text-negative">{errors.name.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>

          <Input
            type="email"
            id="email"
            autoComplete="off"
            disabled={isSubmitting}
            {...register('email')}
          />

          {!!errors.email?.message && (
            <small className="text-negative">{errors.email.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>

          <Input
            type="password"
            id="password"
            disabled={isSubmitting}
            {...register('password')}
          />

          {!!errors.password?.message && (
            <small className="text-negative">{errors.password.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>

          <Input
            type="password"
            id="confirmPassword"
            disabled={isSubmitting}
            {...register('confirmPassword')}
          />

          {!!errors.confirmPassword?.message && (
            <small className="text-negative">
              {errors.confirmPassword.message}
            </small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baseCurrency">Base currency</Label>

          <Controller
            name="baseCurrency"
            control={control}
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                disabled={isSubmitting}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="baseCurrency"
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

          {!!errors.baseCurrency?.message && (
            <small className="text-negative">
              {errors.baseCurrency.message}
            </small>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-12 p-6"
        aria-label="Register"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span>Register</span>
        )}
      </Button>
    </form>
  );
};
