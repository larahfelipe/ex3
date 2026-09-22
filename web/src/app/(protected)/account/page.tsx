'use client';

import { useId } from 'react';

import { Loader2, LogOut } from 'lucide-react';

import { ErrorState, LoadingState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import { useCurrentUser, useSignOut } from '@/hooks/use-user';

import { PasswordForm } from './_components/password-form';
import { ProfileForm } from './_components/profile-form';

export default function Account() {
  const { data: user, isError, refetch } = useCurrentUser();
  const { mutate: signOut, isPending: isSigningOut } = useSignOut();

  const profileHeadingId = useId();
  const securityHeadingId = useId();

  return (
    <div className="space-y-6 px-3 py-8 sm:px-4">
      <PageHeader
        title="Account"
        description="Your profile and security details"
        action={
          <Button
            variant="outline"
            className="gap-2 sm:hidden"
            disabled={isSigningOut}
            onClick={() => signOut()}
          >
            {isSigningOut ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <LogOut aria-hidden="true" className="size-4" />
            )}

            <span>Sign out</span>
          </Button>
        }
      />

      <section aria-labelledby={profileHeadingId} className="min-w-0">
        <Card className="shadow-none">
          <SectionHeader
            id={profileHeadingId}
            title="Profile"
            description="Your name and the email you sign in with"
          />

          {user !== undefined ? (
            <ProfileForm user={user} />
          ) : (
            <CardContent>
              {isError ? (
                <ErrorState
                  message="Your account details could not be loaded"
                  onRetry={refetch}
                />
              ) : (
                <LoadingState
                  label="Loading your account details"
                  className="h-24"
                />
              )}
            </CardContent>
          )}
        </Card>
      </section>

      <section aria-labelledby={securityHeadingId} className="min-w-0">
        <Card className="shadow-none">
          <SectionHeader
            id={securityHeadingId}
            title="Security"
            description="Changing your password signs you out everywhere, including here"
          />

          <PasswordForm />
        </Card>
      </section>
    </div>
  );
}
