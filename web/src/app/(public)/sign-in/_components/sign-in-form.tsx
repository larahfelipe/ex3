'use client';

import { type FC } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { FormField } from '@/components/form-field';
import { Button, Input } from '@/components/ui';
import { useSignIn } from '@/hooks/use-user';
import { withSettledRejection } from '@/lib/utils';

type SignInFormValues = z.infer<typeof signInSchema>;

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required')
});

export const SignInForm: FC = () => {
  const { mutateAsync: signInMutationFn } = useSignIn();

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    mode: 'onChange',
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const handleSignIn: SubmitHandler<SignInFormValues> = async (formData) => {
    await signInMutationFn(formData);
    reset();
  };

  return (
    <form
      noValidate
      onSubmit={withSettledRejection(handleSubmit(handleSignIn))}
    >
      <div className="space-y-4">
        <FormField label="Email" error={errors.email?.message}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="username"
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              {...register('password')}
            />
          )}
        </FormField>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full mt-12 gap-2"
      >
        {isSubmitting && (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        )}

        <span>Login</span>
      </Button>
    </form>
  );
};
