'use client';

import { useCallback, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button, Input, Label } from '@/components/ui';
import { useUser } from '@/hooks/use-user';

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(1, 'Password is required')
});

export const SignInForm: FC = () => {
  const { isLoading, signIn } = useUser();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<z.infer<typeof signInSchema>>({
    mode: 'onChange',
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });
  const { push } = useRouter();

  const signInHandler: SubmitHandler<z.infer<typeof signInSchema>> =
    useCallback(
      async (formData) => {
        try {
          await signIn(formData);
          reset();
          push('/dashboard');
        } catch (_) {
          // noop
        }
      },
      [signIn, reset, push]
    );

  return (
    <form onSubmit={handleSubmit(signInHandler)}>
      <div className="flex-col align-center space-y-4">
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
      </div>

      <Button
        type="submit"
        disabled={isLoading || !isValid}
        className="w-full mt-12 p-6"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <p>Login</p>
        )}
      </Button>
    </form>
  );
};
