/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button, Input, Label } from '@/components/ui';
import { useUser } from '@/hooks/use-user';

type SignUpFormValues = z.infer<typeof signUpSchema>;

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
  const { signUpMutationFn } = useUser();

  const {
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
      confirmPassword: ''
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
    <form onSubmit={handleSubmit(handleSignUp)}>
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
            <small className="text-red-500">{errors.name.message}</small>
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
            <small className="text-red-500">{errors.email.message}</small>
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
            <small className="text-red-500">{errors.password.message}</small>
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
            <small className="text-red-500">
              {errors.confirmPassword.message}
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
