/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import { APP_ROUTES } from '@/common/constants';

import { SignUpForm } from './_components/sign-up-form';

export const metadata: Metadata = {
  title: 'Sign Up'
};

export default function SignUp() {
  return (
    <>
      <section className="mx-auto space-y-1.5">
        <p className="text-center text-lg font-semibold font-display">EX3</p>

        <div className="w-full h-px bg-border" />

        <h1 className="text-base text-muted-foreground text-center">
          Create your account
        </h1>
      </section>

      <section className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
        <SignUpForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link
            href={APP_ROUTES.Public.SignIn}
            className="leading-6 text-foreground underline underline-offset-4 hover:text-foreground/90"
          >
            Sign in instead
          </Link>
        </p>
      </section>
    </>
  );
}
