/* eslint-disable react/jsx-newline */

import type { Metadata } from 'next';
import Link from 'next/link';

import { SignUpForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'EX3 | Sign Up'
};

export default function SignUp() {
  return (
    <div className="h-screen relative bg-slate-50 lg:grid-cols-2 md:grid">
      <div className="absolute right-12 bottom-0">
        <h1 className="italic text-[256px] font-extrabold leading-tight text-slate-100 cursor-default">
          EX3
        </h1>
      </div>

      <div className="h-full flex flex-col justify-center align-center relative space-y-8 shadow-sm bg-white border-[1px] border-slate-100">
        <h2 className="text-lg font-bold text-slate-700 text-center">
          Create your account
        </h2>

        <div className="w-full flex flex-col justify-center mx-auto px-6 sm:w-[400px] sm:px-0">
          <SignUpForm />

          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{' '}
            <Link
              href="/auth/sign-in"
              className="font-semibold leading-6 text-slate-900 hover:text-gray-700"
            >
              Login instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
