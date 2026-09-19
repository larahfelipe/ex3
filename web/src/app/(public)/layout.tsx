/* eslint-disable react/jsx-newline */
'use client';

import Image from 'next/image';
import Link from 'next/link';

import type { Children } from '@/types';

import pkg from '../../../package.json';

export default function Layout({ children }: Children) {
  return (
    <main className="h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="h-full min-h-168 flex flex-col justify-center align-center relative space-y-8">
        {children}

        <Link
          href={pkg.author.url}
          rel="noopener noreferrer"
          className="absolute bottom-3 self-center"
        >
          <p className="text-sm text-muted-foreground">
            © {pkg.author.name} {new Date().getFullYear()} - v.{pkg.version}
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
