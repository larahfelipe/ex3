/* eslint-disable react/jsx-newline */

import type { Metadata } from 'next';
import Link from 'next/link';

import { SignUpForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'EX3 | Sign Up'
};

export default function SignUp() {
  return (
    <>
      <section className="mx-auto space-y-2">
        <h2 className="text-lg font-bold text-slate-700 text-center">EX3</h2>

        <div className="w-full h-[1px] bg-gray-100" />

        <h2 className="text-md font-bold text-slate-500 text-center">
          Create your account
        </h2>
      </section>

      <section className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
        <SignUpForm />

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link
            href="/sign-in"
            className="font-semibold leading-6 text-slate-900 hover:text-gray-700"
          >
            Login instead
          </Link>
        </p>
      </section>
    </>
  );
}
