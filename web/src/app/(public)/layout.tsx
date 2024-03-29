'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { raleway } from '@/common/constants';
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

  if (isLoading || user)
    return (
      <main className="h-lvh flex">
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-screen relative bg-gray-50 lg:grid-cols-2 md:grid">
      <aside className="absolute right-10 bottom-5">
        <span
          className={twMerge(
            'italic text-[128px] font-extrabold leading-tight text-gray-100 cursor-default',
            raleway.className
          )}
        >
          EX3
        </span>
      </aside>

      <aside className="h-full flex flex-col justify-center align-center relative space-y-8 shadow-sm bg-white border-[1px] border-gray-200">
        {children}
      </aside>
    </main>
  );
}
