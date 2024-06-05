'use client';

import { useCallback, type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

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
  const { signIn } = useUser();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof signInSchema>>({
    mode: 'onChange',
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const signInHandler: SubmitHandler<z.infer<typeof signInSchema>> =
    useCallback(
      async (formData) => {
        try {
          await signIn(formData);
          reset();
        } catch (_) {
          // noop
        }
      },
      [signIn, reset]
    );

  return (
    <form onSubmit={handleSubmit(signInHandler)}>
      <div className="flex-col align-center space-y-4">
        <div className="space-y-2">
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

        <div className="space-y-2">
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
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-12 p-6"
        aria-label="Login"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span>Login</span>
        )}
      </Button>
    </form>
  );
};
