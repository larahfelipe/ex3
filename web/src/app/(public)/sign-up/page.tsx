/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import { twMerge } from 'tailwind-merge';

import { raleway } from '@/common/constants';

import { SignUpForm } from './_components/sign-up-form';

export const metadata: Metadata = {
  title: 'EX3 | Sign Up'
};

export default function SignUp() {
  return (
    <>
      <section className="mx-auto space-y-1.5">
        <h2
          className={twMerge(
            'text-lg font-semibold text-center',
            raleway.className
          )}
        >
          EX3
        </h2>

        <div className="w-full h-[1px] bg-gray-700" />

        <h2 className="text-md text-gray-400 text-center">
          Create your account
        </h2>
      </section>

      <section className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
        <SignUpForm />

        <p className="mt-6 text-center text-sm text-gray-400">
          Already registered?{' '}
          <Link
            href="/sign-in"
            className="leading-6 text-white hover:text-white/90"
          >
            Login instead
          </Link>
        </p>
      </section>
    </>
  );
}
