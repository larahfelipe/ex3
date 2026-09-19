/* eslint-disable react/jsx-newline */
'use client';

import Image from 'next/image';
import Link from 'next/link';

import type { Children } from '@/types';

import pkg from '../../../package.json';

export default function Layout({ children }: Children) {
  return (
    <div className="h-screen bg-background lg:grid lg:grid-cols-2">
      <main className="h-full min-h-168 flex flex-col justify-center align-center relative space-y-8">
        {children}

        <footer className="absolute bottom-3 self-center">
          <Link
            href={pkg.author.url}
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground"
          >
            © {pkg.author.name} {new Date().getFullYear()} - v.{pkg.version}
          </Link>
        </footer>
      </main>

      <div className="relative max-sm:hidden">
        <Image
          priority
          fill
          src="/login-hero.jpeg"
          alt=""
          className="w-full h-full absolute"
          style={{ objectFit: 'cover' }}
        />
      </div>
    </div>
  );
}
