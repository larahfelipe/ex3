'use client';

import type { FC } from 'react';
import { FiUser } from 'react-icons/fi';
import { IoExitOutline, IoHomeOutline } from 'react-icons/io5';

import { useUser } from '@/hooks/use-user';

import { Button } from './ui';

export const Sidebar: FC = () => {
  const { user, signOut } = useUser();

  return (
    <div className="w-[200px] h-lvh flex flex-col items-center relative bg-slate-50">
      <div className="mt-3">
        <h2 className="text-lg font-bold text-slate-700 text-center">EX3</h2>
      </div>

      <div className="w-[90%] flex mt-8">
        <Button variant="secondary" className="w-full">
          <IoHomeOutline size={18} />

          <span className="ml-1.5">Dashboard</span>
        </Button>
      </div>

      <div className="w-[90%] flex flex-col items-center gap-2 absolute bottom-3">
        <Button variant="secondary" className="w-full">
          <FiUser size={18} />

          <span className="ml-1.5">{user?.name || 'Unknown'}</span>
        </Button>

        <Button
          variant="ghost"
          className="w-full hover:bg-red-50"
          onClick={signOut}
        >
          <IoExitOutline size={18} className="text-red-500" />

          <span className="ml-1.5 text-red-500 transition-all active:scale-50">
            Logout
          </span>
        </Button>
      </div>
    </div>
  );
};
