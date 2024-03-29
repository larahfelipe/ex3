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
    <div className="space-y-12 mx-4 md:mx-16">
      <Card className="mt-12 shadow-none">
        <CardHeader>
          <CardTitle className="text-gray-700">Profile</CardTitle>

          <CardDescription>Your account details</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 [&_label]:text-gray-700">
          <section className="space-y-1.5">
            <Label htmlFor="name" className="text-gray-700">
              Name
            </Label>

            <Input disabled id="name" value={user.name} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>

            <Input disabled id="email" value={user.email} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="creation" className="text-gray-700">
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
          <Button disabled variant="secondary" className="h-9 max-sm:w-full">
            Update
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-gray-700">Security</CardTitle>

          <CardDescription>
            Manage your account security details
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 [&_label]:text-gray-700">
          <section className="space-y-1.5">
            <Label className="text-gray-700">Old password</Label>

            <Input type="password" placeholder="Enter your password" />
          </section>

          <section className="space-y-1.5">
            <Label className="text-gray-700">New password</Label>

            <Input type="password" placeholder="Enter your new password" />
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
