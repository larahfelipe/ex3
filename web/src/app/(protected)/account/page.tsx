'use client';

import { useId } from 'react';

import { Loader2, LogOut } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { ErrorState, LoadingState } from '@/components/data-state';
import { FormField } from '@/components/form-field';
import { LanguageSelect } from '@/components/language-select';
import { PageHeader } from '@/components/page-header';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import { useCurrentUser, useSignOut } from '@/hooks/use-user';

import { PasswordForm } from './_components/password-form';
import { ProfileForm } from './_components/profile-form';

export default function Account() {
  const { data: user, isError, refetch } = useCurrentUser();
  const { mutate: signOut, isPending: isSigningOut } = useSignOut();

  const t = useTranslations('account');
  const tNavigation = useTranslations('navigation');
  const tLanguage = useTranslations('common.language');

  const profileHeadingId = useId();
  const securityHeadingId = useId();
  const preferencesHeadingId = useId();

  return (
    <div className="space-y-6">
      <PageHeader
        title={tNavigation('pages.account')}
        description={t('description')}
        action={
          <Button
            variant="outline"
            className="gap-2 sm:hidden"
            aria-disabled={isSigningOut}
            onClick={() => {
              if (!isSigningOut) signOut();
            }}
          >
            {isSigningOut ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <LogOut aria-hidden="true" className="size-4" />
            )}

            <span>{tNavigation('signOut')}</span>
          </Button>
        }
      />

      <section aria-labelledby={profileHeadingId} className="min-w-0">
        <Card>
          <SectionHeader
            id={profileHeadingId}
            title={t('profile.title')}
            description={t('profile.description')}
          />

          {user !== undefined ? (
            <ProfileForm user={user} />
          ) : (
            <CardContent>
              {isError ? (
                <ErrorState message={t('loadFailed')} onRetry={refetch} />
              ) : (
                <LoadingState label={t('loading')} className="h-24" />
              )}
            </CardContent>
          )}
        </Card>
      </section>

      <section aria-labelledby={securityHeadingId} className="min-w-0">
        <Card>
          <SectionHeader
            id={securityHeadingId}
            title={t('security.title')}
            description={t('security.description')}
          />

          <PasswordForm email={user?.email} />
        </Card>
      </section>

      <section aria-labelledby={preferencesHeadingId} className="min-w-0">
        <Card>
          <SectionHeader
            id={preferencesHeadingId}
            title={t('preferences.title')}
            description={t('preferences.description')}
          />

          <CardContent>
            <FormField
              label={tLanguage('label')}
              hint={t('preferences.languageHint')}
            >
              {({ id, 'aria-describedby': describedBy }) => (
                <LanguageSelect id={id} aria-describedby={describedBy} />
              )}
            </FormField>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
