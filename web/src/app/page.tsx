'use client';

import { useEffect, useState } from 'react';

import { redirect } from 'next/navigation';

type WithId = Record<'id', string>;

interface UserProperties {
  name: string;
  email: string;
  isStaff: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User extends WithId, UserProperties {}

export default function Home() {
  const [user, setUser] = useState({} as User);

  useEffect(() => {
    if (user?.id) redirect('/dashboard');

    redirect('/sign-in');
  }, [user]);

  return (
    <div>
      <h1 className="text-violet-200">Home page</h1>
    </div>
  );
}
