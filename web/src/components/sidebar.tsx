'use client';

import type { FC, ReactNode } from 'react';
import { LuUser } from 'react-icons/lu';
import { RxDashboard, RxExit } from 'react-icons/rx';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { House } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { APP_ROUTES } from '@/common/constants';
import { useCurrentUser, useSignOut } from '@/hooks/use-user';

import { Button } from './ui';

type NavigationSection = Record<'name' | 'path', string> &
  Record<'icon', ReactNode>;

type NavigationLinkProps = Omit<NavigationSection, 'name'> &
  Record<'label', string> &
  Record<'isActive', boolean>;

const MAIN_SECTIONS: Array<NavigationSection> = [
  {
    name: 'Overview',
    path: APP_ROUTES.Protected.Overview,
    icon: <House size={18} />
  },
  {
    name: 'Assets',
    path: APP_ROUTES.Protected.Assets,
    icon: <RxDashboard size={18} />
  }
];

const ACCOUNT_SECTION = {
  name: 'Account',
  path: APP_ROUTES.Protected.Account
} as const;

const NAVIGATION_ITEM_CLASS = 'w-full gap-1.5 active:scale-90';

const isCurrentPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

const NavigationLink: FC<NavigationLinkProps> = ({
  label,
  path,
  icon,
  isActive
}) => (
  <Button
    asChild
    variant={isActive ? 'secondary' : 'ghost'}
    className={twMerge(NAVIGATION_ITEM_CLASS, isActive && 'bg-muted/70')}
  >
    <Link href={path} aria-current={isActive ? 'page' : undefined}>
      <span aria-hidden="true">{icon}</span>

      <span className="max-sm:sr-only">{label}</span>
    </Link>
  </Button>
);

export const Sidebar: FC = () => {
  const pathname = usePathname();

  const { mutate: signOut } = useSignOut();
  const { data: user } = useCurrentUser();

  return (
    <nav
      aria-label="Main"
      className="h-(--navigation-bar) flex items-center relative sm:w-(--navigation-rail) sm:h-screen sm:flex-col sm:fixed sm:overflow-y-auto"
    >
      <p className="max-sm:ml-4 sm:mt-3 text-lg font-bold text-center cursor-default font-display hover:animate-pulse">
        EX3
      </p>

      <ul className="flex gap-2 max-sm:ml-8 sm:w-[95%] sm:mt-8 sm:flex-col">
        {MAIN_SECTIONS.map(({ name, path, icon }) => (
          <li key={path} className="sm:w-full">
            <NavigationLink
              label={name}
              path={path}
              icon={icon}
              isActive={isCurrentPath(pathname, path)}
            />
          </li>
        ))}
      </ul>

      <ul className="flex gap-2 absolute max-sm:right-1 sm:w-[95%] sm:flex-col sm:items-center sm:bottom-3">
        <li className="sm:w-full">
          <NavigationLink
            label={user?.name ?? ACCOUNT_SECTION.name}
            path={ACCOUNT_SECTION.path}
            icon={<LuUser size={18} />}
            isActive={isCurrentPath(pathname, ACCOUNT_SECTION.path)}
          />
        </li>

        <li className="sm:w-full">
          <Button
            variant="ghost"
            className={twMerge(NAVIGATION_ITEM_CLASS, 'hover:bg-negative/10')}
            onClick={() => signOut()}
          >
            <RxExit size={18} aria-hidden="true" className="text-negative" />

            <span className="max-sm:sr-only text-negative">Sign out</span>
          </Button>
        </li>
      </ul>
    </nav>
  );
};
