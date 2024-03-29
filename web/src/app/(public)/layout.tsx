'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

export default function Layout({ children }: Readonly<Children>) {
  const { isLoading, user } = useUser();

  const { replace } = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      replace('/dashboard');
    }
  }, [isLoading, user, replace]);

  if (isLoading || user) return null;

  return (
    <main className="h-screen relative bg-white lg:grid-cols-2 md:grid">
      <aside className="absolute right-10 bottom-5">
        <span className="italic text-[128px] font-extrabold leading-tight text-gray-50 cursor-default">
          EX3
        </span>
      </aside>

      <aside className="h-full flex flex-col justify-center align-center relative space-y-8 shadow-sm bg-slate-50 border-[1px] border-slate-100">
        {children}
      </aside>
    </main>
  );
}
