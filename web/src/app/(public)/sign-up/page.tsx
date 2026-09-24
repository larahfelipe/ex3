import type { Metadata } from 'next';

import { APP_ROUTES } from '@/common/constants';

import { AuthAlternative } from '../_components/auth-alternative';
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

        <AuthAlternative
          question="Already registered?"
          href={APP_ROUTES.Public.SignIn}
          label="Sign in instead"
        />
      </section>
    </>
  );
}
