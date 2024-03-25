/* eslint-disable react/jsx-newline */

import type { Metadata } from 'next';
import Link from 'next/link';

import { SignInForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'EX3 | Sign In'
};

export default function SignIn() {
  return (
    <>
      <section className="mx-auto space-y-1.5">
        <h2 className="text-lg font-bold text-slate-700 text-center">EX3</h2>

        <div className="w-full h-[1px] bg-gray-100" />

        <h2 className="text-md font-bold text-slate-500 text-center">
          Sign in to your account
        </h2>
      </section>

      <section className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
        <SignInForm />

        <p className="mt-6 text-center text-sm text-slate-500">
          Not registered?{' '}
          <Link
            href="/sign-up"
            className="font-semibold leading-6 text-slate-900 hover:text-gray-700"
          >
            Create account
          </Link>
        </p>
      </section>
    </>
  );
}
