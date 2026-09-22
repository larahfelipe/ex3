/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import { TriangleAlert } from 'lucide-react';

import {
  APP_ROUTES,
  SIGN_IN_PARAMS,
  SIGN_IN_REASONS
} from '@/common/constants';

import { SignInForm } from './_components/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in'
};

/**
 * The return path arrives in the address bar, so only a path on this origin is
 * followed: a second `/` or a `\` right after the first, or a tab or line break
 * anywhere, which URL parsing drops, would let it name another host.
 */
const RETURN_PATH_PATTERN = /^\/(?![/\\])[^\\\s]*$/;

type SignInProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignIn({ searchParams }: SignInProps) {
  const params = await searchParams;
  const requestedReturnPath = params[SIGN_IN_PARAMS.ReturnPath];
  const destination =
    typeof requestedReturnPath === 'string' &&
    RETURN_PATH_PATTERN.test(requestedReturnPath)
      ? requestedReturnPath
      : APP_ROUTES.Protected.Overview;
  const hasSessionExpired =
    params[SIGN_IN_PARAMS.Reason] === SIGN_IN_REASONS.SessionExpired;

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
        {hasSessionExpired && (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            Your session expired. Sign in again to continue.
          </p>
        )}

        <SignInForm destination={destination} />

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
