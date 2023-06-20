import { useContext } from 'react';

import { AuthContext } from '@/providers';

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  return ctx;
};
