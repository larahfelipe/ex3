'use client';

import { useId } from 'react';

import { ErrorState } from '@/components/data-state';
import { PageHeader } from '@/components/page-header';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  Label,
  Skeleton
} from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-user';

export default function Account() {
  const { data: user, isLoading, isError, refetch } = useCurrentUser();

  const profileHeadingId = useId();
  const securityHeadingId = useId();

  return (
    <div className="space-y-6 px-3 py-8 sm:px-4">
      <PageHeader
        title="Account"
        description="Your profile and security details"
      />

      <section aria-labelledby={profileHeadingId} className="min-w-0">
        <Card className="shadow-none">
          <SectionHeader
            id={profileHeadingId}
            title="Profile"
            description="Your account details"
          />

          <CardContent className="space-y-5" aria-busy={isLoading}>
            {isError ? (
              <ErrorState
                message="Your account details could not be loaded"
                onRetry={refetch}
              />
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>

                  {user ? (
                    <Input
                      disabled
                      id="name"
                      value={user.name ?? ''}
                      className="bg-surface"
                    />
                  ) : (
                    <Skeleton className="h-9 w-full" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>

                  {user ? (
                    <Input
                      disabled
                      id="email"
                      value={user.email}
                      className="bg-surface"
                    />
                  ) : (
                    <Skeleton className="h-9 w-full" />
                  )}
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-end">
            <Button disabled variant="secondary" className="h-9 max-sm:w-full">
              Update
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section aria-labelledby={securityHeadingId} className="min-w-0">
        <Card className="shadow-none">
          <SectionHeader
            id={securityHeadingId}
            title="Security"
            description="Manage your account security details"
          />

          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="old-password">Old password</Label>

              <Input
                id="old-password"
                type="password"
                placeholder="Enter your password"
                className="bg-surface"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>

              <Input
                id="new-password"
                type="password"
                placeholder="Enter your new password"
                className="bg-surface"
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end">
            <Button disabled variant="secondary" className="h-9 max-sm:w-full">
              Update
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
