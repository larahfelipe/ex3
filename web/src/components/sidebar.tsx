'use client';

import type { FC, ReactNode } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { House, LayoutGrid, LogOut, User, Wallet } from 'lucide-react';
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
    icon: <LayoutGrid size={18} />
  },
  {
    name: 'Portfolios',
    path: APP_ROUTES.Protected.Portfolios,
    icon: <Wallet size={18} />
  }
];

const ACCOUNT_SECTION = {
  name: 'Account',
  path: APP_ROUTES.Protected.Account
} as const;

/** WCAG 2.5.5 asks for a 44px target, above the default button height. */
const NAVIGATION_ITEM_CLASS =
  'w-full min-h-11 gap-1.5 motion-safe:active:scale-90 max-sm:min-w-11';

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
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--navigation-bar) items-center justify-around border-t bg-background sm:inset-y-0 sm:right-auto sm:h-screen sm:w-(--navigation-rail) sm:flex-col sm:justify-start sm:border-t-0 sm:overflow-y-auto"
    >
      <p className="max-sm:hidden mt-3 text-lg font-bold text-center cursor-default font-display hover:animate-pulse">
        EX3
      </p>

      <ul className="flex flex-1 justify-around gap-2 sm:mt-8 sm:w-[95%] sm:flex-none sm:flex-col sm:justify-start">
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

      <ul className="flex flex-1 justify-around gap-2 sm:absolute sm:bottom-3 sm:w-[95%] sm:flex-none sm:flex-col sm:items-center">
        <li className="sm:w-full">
          <NavigationLink
            label={user?.name ?? ACCOUNT_SECTION.name}
            path={ACCOUNT_SECTION.path}
            icon={<User size={18} />}
            isActive={isCurrentPath(pathname, ACCOUNT_SECTION.path)}
          />
        </li>

        <li className="sm:w-full">
          <Button
            variant="ghost"
            className={twMerge(NAVIGATION_ITEM_CLASS, 'hover:bg-negative/10')}
            onClick={() => signOut()}
          >
            <LogOut size={18} aria-hidden="true" className="text-negative" />

            <span className="max-sm:sr-only text-negative">Sign out</span>
          </Button>
        </li>
      </ul>
    </nav>
  );
};
