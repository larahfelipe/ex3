/* eslint-disable react/jsx-newline */
'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Loader2 } from 'lucide-react';

import { currentYear } from '@/common/utils';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

import pkg from '../../../package.json';

export default function Layout({ children }: Children) {
  const { isLoading } = useUser();

  if (isLoading)
    return (
      <main className="h-screen flex">
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-screen bg-black lg:grid lg:grid-cols-2">
      <aside className="h-full flex flex-col justify-center align-center relative space-y-8">
        {children}

        <Link href={pkg.author.url} className="absolute bottom-3 self-center">
          <p className="text-sm text-gray-500">
            © {pkg.author.name} {currentYear} - v.{pkg.version}
          </p>
        </Link>
      </aside>

      <aside className="relative max-sm:hidden">
        <Image
          priority
          fill
          src="/login-hero.jpeg"
          alt="Login Hero"
          className="w-full h-full absolute"
          style={{ objectFit: 'cover' }}
        />
      </aside>
    </main>
  );
}
