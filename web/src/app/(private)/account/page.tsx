'use client';

import { Loader2 } from 'lucide-react';

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

  if (!user) return <Loader2 className="m-auto size-6 animate-spin" />;

  return (
    <div className="space-y-12 mx-4 md:mx-16">
      <Card className="mt-12 border-slate-100">
        <CardHeader>
          <CardTitle className="text-slate-700">Profile</CardTitle>

          <CardDescription>Your account details</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 [&_label]:text-slate-700">
          <section className="space-y-1.5">
            <Label htmlFor="name" className="text-slate-700">
              Name
            </Label>

            <Input disabled id="name" value={user.name} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-700">
              Email
            </Label>

            <Input disabled id="email" value={user.email} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="creation" className="text-slate-700">
              Joined at
            </Label>

            <Input
              disabled
              id="email"
              value={new Date(user.createdAt).toString()}
            />
          </section>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button disabled className="h-9 max-sm:w-full">
            Update
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-slate-100">
        <CardHeader>
          <CardTitle className="text-slate-700">Security</CardTitle>

          <CardDescription>
            Manage your account security details
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 [&_label]:text-slate-700">
          <section className="space-y-1.5">
            <Label className="text-slate-700">Current password</Label>

            <Input type="password" placeholder="Enter your password" />
          </section>

          <section className="space-y-1.5">
            <Label className="text-slate-700">New password</Label>

            <Input type="password" placeholder="Enter your new password" />
          </section>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button disabled className="h-9 max-sm:w-full">
            Update
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
