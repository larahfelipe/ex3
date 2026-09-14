'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton
} from '@/components/ui';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function Account() {
  const { data: user, isLoading, isError, refetch } = useCurrentUser();

  return (
    <div className="space-y-8 my-2 sm:mx-4">
      <Card className="mt-8 shadow-none">
        <CardHeader>
          <CardTitle>Profile</CardTitle>

          <CardDescription>Your account details</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5" aria-busy={isLoading}>
          {isError ? (
            <section role="alert" className="flex flex-col items-start gap-3">
              <p className="text-sm text-red-500">
                Your account details could not be loaded
              </p>

              <Button
                variant="secondary"
                className="h-9 max-sm:w-full"
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </section>
          ) : (
            <>
              <section className="space-y-1.5">
                <Label htmlFor="name">Name</Label>

                {user ? (
                  <Input
                    disabled
                    id="name"
                    value={user.name ?? ''}
                    className="bg-zinc-900"
                  />
                ) : (
                  <Skeleton className="h-9 w-full" />
                )}
              </section>

              <section className="space-y-1.5">
                <Label htmlFor="email">Email</Label>

                {user ? (
                  <Input
                    disabled
                    id="email"
                    value={user.email}
                    className="bg-zinc-900"
                  />
                ) : (
                  <Skeleton className="h-9 w-full" />
                )}
              </section>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button disabled variant="secondary" className="h-9 max-sm:w-full">
            Update
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Security</CardTitle>

          <CardDescription>
            Manage your account security details
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <section className="space-y-1.5">
            <Label>Old password</Label>

            <Input
              type="password"
              placeholder="Enter your password"
              className="bg-zinc-900"
            />
          </section>

          <section className="space-y-1.5">
            <Label>New password</Label>

            <Input
              type="password"
              placeholder="Enter your new password"
              className="bg-zinc-900"
            />
          </section>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button disabled variant="secondary" className="h-9 max-sm:w-full">
            Update
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
