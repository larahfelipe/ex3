/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  APP_ROUTES,
  SIGN_IN_PARAMS,
  SIGN_IN_REASONS
} from '@/common/constants';

import { AuthNotice } from '../_components/auth-notice';
import { PublicPageHeader } from '../_components/public-page-header';
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
      <PublicPageHeader title="Sign in to your account" />

      <section>
        {hasSessionExpired && (
          <AuthNotice tone="warning" className="mb-6">
            Your session expired. Sign in again to continue.
          </AuthNotice>
        )}

        <SignInForm destination={destination} />

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Not registered?{' '}
          <Link
            href={APP_ROUTES.Public.SignUp}
            className="rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 ring-offset-background transition-colors hover:decoration-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Create account
          </Link>
        </p>
      </section>
    </>
  );
}
