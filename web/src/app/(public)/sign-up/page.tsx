import type { Metadata } from 'next';

import { APP_ROUTES } from '@/common/constants';
import { getServerTranslator } from '@/i18n/server';
import { botChallengeSiteKey } from '@/lib/bot-challenge';

import { AuthAlternative } from '../_components/auth-alternative';
import { PublicPageHeader } from '../_components/public-page-header';
import { SignUpForm } from './_components/sign-up-form';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('signUp')
});

export default async function SignUp() {
  const t = await getServerTranslator('auth.signUp');

  return (
    <>
      <PublicPageHeader title={t('title')} />

      <section>
        <SignUpForm challengeSiteKey={botChallengeSiteKey()} />

        <AuthAlternative
          question={t('hasAccount')}
          href={APP_ROUTES.Public.SignIn}
          label={t('signInInstead')}
        />
      </section>
    </>
  );
}
