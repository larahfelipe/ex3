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
  Label
} from '@/components/ui';
import { useUser } from '@/hooks/use-user';

export default function Account() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <div className="space-y-8 my-2 sm:mx-4">
      <Card className="mt-8 shadow-none">
        <CardHeader>
          <CardTitle>Profile</CardTitle>

          <CardDescription>Your account details</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <section className="space-y-1.5">
            <Label htmlFor="name">Name</Label>

            <Input
              disabled
              id="name"
              value={user.name}
              className="bg-zinc-900"
            />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="email">Email</Label>

            <Input
              disabled
              id="email"
              value={user.email}
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
