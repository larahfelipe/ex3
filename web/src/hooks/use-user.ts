import { useContext } from 'react';

import { UserContext } from '@/providers/user-provider';

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');

  return ctx;
};
