/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useCallback, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button, Input, Label } from '@/components/ui';
import { useUser } from '@/hooks/use-user';

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
      .trim()
      .min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z
      .string()
      .trim()
      .min(6, 'Confirm password must be at least 6 characters long')
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  });

export const SignUpForm: FC = () => {
  const { isLoading, signUp } = useUser();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<z.infer<typeof signUpSchema>>({
    mode: 'onChange',
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });
  const { push } = useRouter();

  const signUpHandler: SubmitHandler<z.infer<typeof signUpSchema>> =
    useCallback(
      async ({ confirmPassword, ...formData }) => {
        try {
          await signUp(formData);
          push('/dashboard');
          reset();
        } catch (_) {
          // noop
        }
      },
      [signUp, reset, push]
    );

  return (
    <form onSubmit={handleSubmit(signUpHandler)}>
      <div className="flex-col align-center space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-slate-700">
            Name
          </Label>

          <Input
            id="name"
            disabled={isLoading}
            autoCorrect="off"
            {...register('name')}
          />

          {!!errors.name?.message && (
            <small className="text-red-500">{errors.name.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-700">
            Email
          </Label>

          <Input
            type="email"
            id="email"
            autoComplete="off"
            disabled={isLoading}
            {...register('email')}
          />

          {!!errors.email?.message && (
            <small className="text-red-500">{errors.email.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-700">
            Password
          </Label>

          <Input
            type="password"
            id="password"
            disabled={isLoading}
            {...register('password')}
          />

          {!!errors.password?.message && (
            <small className="text-red-500">{errors.password.message}</small>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-slate-700">
            Confirm password
          </Label>

          <Input
            type="password"
            id="confirmPassword"
            disabled={isLoading}
            {...register('confirmPassword')}
          />

          {!!errors.confirmPassword?.message && (
            <small className="text-red-500">
              {errors.confirmPassword.message}
            </small>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !isValid}
        className="w-full mt-12 p-6"
        aria-label="Register"
      >
        {isLoading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <span>Register</span>
        )}
      </Button>
    </form>
  );
};
