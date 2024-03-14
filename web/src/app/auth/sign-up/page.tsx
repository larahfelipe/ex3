/* eslint-disable react/jsx-newline */

import type { Metadata } from 'next';
import Link from 'next/link';

import { SignUpForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'EX3 | Sign Up'
};

export default function SignUp() {
  return (
    <div className="h-screen relative bg-white lg:grid-cols-2 md:grid">
      <div className="absolute right-10 bottom-5">
        <p className="italic text-[128px] font-extrabold leading-tight text-gray-50 cursor-default">
          EX3
        </p>
      </div>

      <div className="h-full flex flex-col justify-center align-center relative space-y-8 shadow-sm bg-gray-50 border-[1px] border-gray-100">
        <div className="mx-auto space-y-2">
          <h2 className="text-lg font-bold text-slate-700 text-center">EX3</h2>

          <div className="w-full h-[1px] bg-gray-100" />

          <h2 className="text-md font-bold text-slate-500 text-center">
            Create your account
          </h2>
        </div>

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
