import type { Metadata } from 'next';

import {
  APP_ROUTES,
  SIGN_IN_PARAMS,
  SIGN_IN_REASONS
} from '@/common/constants';
import { getServerTranslator } from '@/i18n/server';

import { AuthAlternative } from '../_components/auth-alternative';
import { AuthNotice } from '../_components/auth-notice';
import { PublicPageHeader } from '../_components/public-page-header';
import { SignInForm } from './_components/sign-in-form';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('signIn')
});

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
  const t = await getServerTranslator('auth.signIn');

  return (
    <>
      <PublicPageHeader title={t('title')} />

      <section>
        {hasSessionExpired && (
          <AuthNotice tone="warning" className="mb-6">
            {t('sessionExpired')}
          </AuthNotice>
        )}

        <SignInForm destination={destination} />

        <AuthAlternative
          question={t('noAccount')}
          href={APP_ROUTES.Public.SignUp}
          label={t('createAccount')}
        />
      </section>
    </>
  );
}
