/* eslint-disable react/jsx-newline */
'use client';

import { useEffect } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { currentYear } from '@/common/utils';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

import pkg from '../../../package.json';

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
    <main className="h-screen lg:grid lg:grid-cols-2">
      <aside className="h-full flex flex-col justify-center align-center relative space-y-8 bg-white">
        {children}

        <Link href={pkg.author.url} className="absolute bottom-3 self-center">
          <p className="text-sm text-gray-700">
            © {pkg.author.name} {currentYear} - v.{pkg.version}
          </p>
        </Link>
      </aside>

      <aside className="relative max-sm:hidden">
        <Image
          priority
          fill
          objectFit="cover"
          src="/login-hero.jpeg"
          alt="Login Hero"
          className="absolute"
        />
      </aside>
    </main>
  );
}
