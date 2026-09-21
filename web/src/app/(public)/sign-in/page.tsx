/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import { APP_ROUTES } from '@/common/constants';

import { SignInForm } from './_components/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign In'
};

export default function SignIn() {
  return (
    <>
      <section className="mx-auto space-y-1.5">
        <p className="text-center text-lg font-semibold font-display">EX3</p>

        <div className="w-full h-px bg-border" />

        <h1 className="text-base text-muted-foreground text-center">
          Sign in to your account
        </h1>
      </section>

      <section className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
        <SignInForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Not registered?{' '}
          <Link
            href={APP_ROUTES.Public.SignUp}
            className="leading-6 text-foreground underline underline-offset-4 hover:text-foreground/90"
          >
            Create account
          </Link>
        </p>
      </section>
    </>
  );
}
