/* eslint-disable react/jsx-newline */

import type { Metadata } from 'next';
import Link from 'next/link';

import { SignInForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'EX3 | Sign In'
};

export default function SignIn() {
  return (
    <div className="h-screen relative bg-slate-50 lg:grid-cols-2 md:grid">
      <h1 className="italic text-[256px] font-extrabold text-slate-100 absolute right-12 bottom-0 cursor-default">
        EX3
      </h1>

      <div className="h-full flex flex-col justify-center align-center relative space-y-8 shadow-sm bg-white border-[1px] border-slate-100">
        <h2 className="text-lg font-bold text-slate-700 text-center">
          Sign in to your account
        </h2>

        <div className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
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
        </div>
      </div>
    </div>
  );
}
