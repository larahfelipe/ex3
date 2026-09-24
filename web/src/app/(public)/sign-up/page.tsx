/* eslint-disable react/jsx-newline */
import type { Metadata } from 'next';
import Link from 'next/link';

import { APP_ROUTES } from '@/common/constants';

import { PublicPageHeader } from '../_components/public-page-header';
import { SignUpForm } from './_components/sign-up-form';

export const metadata: Metadata = {
  title: 'Create account'
};

export default function SignUp() {
  return (
    <>
      <PublicPageHeader title="Create your account" />

      <section>
        <SignUpForm />

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already registered?{' '}
          <Link
            href={APP_ROUTES.Public.SignIn}
            className="rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 ring-offset-background transition-colors hover:decoration-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Sign in instead
          </Link>
        </p>
      </section>
    </>
  );
}
