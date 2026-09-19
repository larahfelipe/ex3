'use client';

import type { FC, HTMLAttributes, JSX } from 'react';
import { LuUser } from 'react-icons/lu';
import { RxDashboard, RxExit } from 'react-icons/rx';

import { usePathname, useRouter } from 'next/navigation';

import { House, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { APP_ROUTES } from '@/common/constants';
import { useCurrentUser, useSignOut } from '@/hooks/use-user';

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ButtonProps
} from './ui';

type SectionButtonProps = Pick<ButtonProps, 'variant' | 'onClick'> & {
  text?: string;
  path?: string;
  left?: JSX.Element;
  className?: {
    button?: HTMLAttributes<HTMLButtonElement>['className'];
    text?: HTMLAttributes<HTMLSpanElement>['className'];
  };
};

const mainSections = [
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
] as const;

const accountSection = {
  name: 'Account',
  path: APP_ROUTES.Protected.Account
} as const;

export const Sidebar: FC = () => {
  const pathname = usePathname();

  const { mutate: signOut } = useSignOut();
  const { data: user, isPending: isUserPending } = useCurrentUser();

  const { push } = useRouter();

  const handleSignOut = () => signOut();

  const SidebarBtn = ({
    onClick,
    left,
    path,
    text,
    className,
    variant = 'secondary'
  }: SectionButtonProps) => {
    const isActive =
      path !== undefined &&
      (pathname === path || pathname.startsWith(`${path}/`));

    return (
      <TooltipProvider>
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant={isActive ? variant : 'ghost'}
              aria-label={text}
              aria-current={isActive ? 'page' : undefined}
              className={twMerge(
                'transition-all duration-200 sm:w-full active:scale-90',
                isActive && 'bg-muted/70',
                className?.button
              )}
              onClick={onClick}
            >
              {!text && <Loader2 className="size-4 animate-spin" />}

              {text && (
                <>
                  {left}

                  <span
                    className={twMerge('ml-1.5 max-sm:hidden', className?.text)}
                  >
                    {text}
                  </span>
                </>
              )}
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <p>{text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <nav className="h-[60px] flex items-center relative sm:w-[160px] sm:h-screen sm:flex-col sm:fixed">
      <p className="max-sm:ml-4 sm:mt-3 text-lg font-bold text-center cursor-default font-display hover:animate-pulse">
        EX3
      </p>

      <menu className="flex gap-2 max-sm:ml-8 sm:w-[95%] sm:mt-8 sm:flex-col">
        {mainSections.map(({ name, path, icon }) => (
          <SidebarBtn
            key={path}
            text={name}
            path={path}
            onClick={() => push(path)}
            left={icon}
          />
        ))}
      </menu>

      <menu className="flex gap-2 absolute max-sm:right-1 sm:w-[95%] sm:flex-col sm:items-center sm:bottom-3">
        <SidebarBtn
          text={isUserPending ? undefined : (user?.name ?? accountSection.name)}
          path={accountSection.path}
          onClick={() => push(accountSection.path)}
          left={<LuUser size={18} />}
        />

        <SidebarBtn
          text="Logout"
          variant="ghost"
          onClick={handleSignOut}
          className={{ button: 'hover:bg-negative/10', text: 'text-negative' }}
          left={<RxExit size={18} className="text-negative" />}
        />
      </menu>
    </nav>
  );
};
