'use client';

import { useCallback, useState, type FC, type HTMLAttributes } from 'react';
import { IoExitOutline } from 'react-icons/io5';
import { LuUser2 } from 'react-icons/lu';
import { RxDashboard } from 'react-icons/rx';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { useUser } from '@/hooks/use-user';

import { Button, type ButtonProps } from './ui';

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
    name: 'Dashboard',
    path: '/dashboard'
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

  const { user, signOut } = useUser();

  const { push } = useRouter();

  const changeActiveSectionPath = useCallback(
    (path: string) => {
      setActiveSectionPath(path);
      push(path);
    },
    [push]
  );

  const SidebarBtn = ({
    onClick,
    left,
    path,
    text,
    className,
    variant = 'secondary'
  }: SectionButtonProps) => (
    <Button
      variant={path === activeSectionPath ? variant : 'ghost'}
      className={twMerge(
        `transition-all duration-200 hover:brightness-95 sm:w-full active:scale-90 ${path === activeSectionPath && 'bg-slate-200'}`,
        className?.button
      )}
      onClick={onClick}
    >
      {!text && <Loader2 className="size-4 animate-spin" />}

      {text && (
        <>
          {left}

          <span className={twMerge('ml-1.5 max-sm:hidden', className?.text)}>
            {text}
          </span>
        </>
      )}
    </Button>
  );

  return (
    <div className="h-[60px] flex items-center relative bg-slate-50 border-[1px] border-slate-100 sm:h-lvh sm:flex-col">
      <section className="max-sm:ml-4 sm:mt-3">
        <h2 className="text-lg font-bold text-slate-700 text-center cursor-default">
          EX3
        </h2>
      </section>

      <section className="max-sm:ml-8 sm:w-[95%] sm:mt-8">
        <SidebarBtn
          text="Dashboard"
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
          onClick={signOut}
          className={{ button: 'hover:bg-red-50', text: 'text-red-500' }}
          left={<IoExitOutline size={18} className="text-red-500" />}
        />
      </section>
    </div>
  );
};
