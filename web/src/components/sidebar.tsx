'use client';

import { useState, type FC, type HTMLAttributes } from 'react';
import { LuUser2 } from 'react-icons/lu';
import { RxDashboard, RxExit } from 'react-icons/rx';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { raleway } from '@/common/constants';
import { useUser } from '@/hooks/use-user';

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

const sections = [
  {
    name: 'Assets',
    path: '/assets'
  },
  {
    name: 'Account',
    path: '/account'
  }
] as const;

export const Sidebar: FC = () => {
  const [activeSectionPath, setActiveSectionPath] = useState<string>(
    sections[0].path
  );

  const { user, signOutMutation } = useUser();

  const { push } = useRouter();

  const changeActiveSectionPath = (path: string) => {
    setActiveSectionPath(path);
    push(path);
  };

  const handleSignOut = () => signOutMutation();

  const SidebarBtn = ({
    onClick,
    left,
    path,
    text,
    className,
    variant = 'secondary'
  }: SectionButtonProps) => (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button
            variant={path === activeSectionPath ? variant : 'ghost'}
            aria-label={text}
            className={twMerge(
              `transition-all duration-200 sm:w-full active:scale-90 ${path === activeSectionPath && 'bg-muted/70'}`,
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

  return (
    <nav className="h-[60px] flex items-center relative sm:h-lvh sm:flex-col">
      <section className="max-sm:ml-4 sm:mt-3">
        <h2
          className={twMerge(
            'text-lg font-bold text-center cursor-default hover:animate-pulse',
            raleway.className
          )}
        >
          EX3
        </h2>
      </section>

      <section className="max-sm:ml-8 sm:w-[95%] sm:mt-8">
        <SidebarBtn
          text={sections[0].name}
          path={sections[0].path}
          onClick={() => changeActiveSectionPath(sections[0].path)}
          left={<RxDashboard size={18} />}
        />
      </section>

      <section className="flex gap-2 absolute max-sm:right-1 sm:w-[95%] sm:flex-col sm:items-center sm:bottom-3">
        <SidebarBtn
          text={user?.name}
          path={sections[1].path}
          onClick={() => changeActiveSectionPath(sections[1].path)}
          left={<LuUser2 size={18} />}
        />

        <SidebarBtn
          text="Logout"
          variant="ghost"
          onClick={handleSignOut}
          className={{ button: 'hover:bg-red-950/40', text: 'text-red-500' }}
          left={<RxExit size={18} className="text-red-500" />}
        />
      </section>
    </nav>
  );
};
