'use client';

import { useState, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { Loader2 } from 'lucide-react';

import { Button, Input, Label } from '@/components/ui';

export const SignInForm: FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const signIn = async () => {
    try {
      setIsLoading(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(signIn)}>
      <div className="flex-col align-center space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-slate-700">
            E-mail
          </Label>

          <Input
            type="email"
            id="email"
            disabled={isLoading}
            {...register('email')}
          />

          {!!errors.email?.message && <p>{errors.email.message}</p>}
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

          {!!errors.password?.message && <p>{errors.password.message}</p>}
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full mt-12 p-6">
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <p>Login</p>
        )}
      </Button>
    </form>
  );
};
